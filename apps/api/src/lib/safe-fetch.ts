import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'
import type { Readable } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

/**
 * Outbound HTTP for user-supplied URLs (job import) with an SSRF guard:
 * - http(s) only, default ports only, no credentials, no single-label/localhost hosts;
 * - every address the host resolves to must be public — checked inside the socket's DNS lookup,
 *   so the validated IP is the one connected to (no DNS-rebinding window); literal IPs too;
 * - redirects followed manually (max 3), each hop re-validated;
 * - 8 s overall timeout, 2 MB body cap counted after decompression (zip bombs).
 */

export class BlockedUrlError extends Error {}
export class FetchFailedError extends Error {}

export type FetchResult = { status: number; url: string; contentType: string; body: string }
export type HttpFetch = (url: string, opts?: { accept?: string }) => Promise<FetchResult>

// One list per family: a single BlockList would match every IPv4 address against ::ffff:0:0/96.
const blockedV4 = new BlockList()
const blockedV6 = new BlockList()
/** IPv6 is allowlisted: only global unicast (2000::/3), minus the special ranges below. */
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
for (const [net, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
] as const)
  blockedV4.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of [
  ['::', 96], // unspecified, loopback, IPv4-compatible
  ['::ffff:0:0', 96], // IPv4-mapped, all of them (also matches ::ffff:a.b.c.d)
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48],
  ['100::', 64], // discard
  ['2001::', 23], // IETF special (Teredo, ORCHID, …)
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local
  ['ff00::', 8], // multicast
] as const)
  blockedV6.addSubnet(net, prefix, 'ipv6')

export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blockedV4.check(address, 'ipv4')
  if (family === 6) return globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6')
  return false
}

type Resolver = (
  hostname: string,
  options: { family?: number; all: true },
  cb: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void

type Options = {
  /** Address policy (tests allow loopback). */
  allowAddress?: (ip: string) => boolean
  /** DNS resolver (tests fake it); default `dns.lookup`. */
  resolve?: Resolver
  ports?: string[]
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
}

const USER_AGENT = 'JobCopilotImporter/1.0 (+job posting import)'

export function createSafeFetch(opts: Options = {}): HttpFetch {
  const allow = opts.allowAddress ?? isPublicAddress
  const ports = opts.ports ?? ['80', '443']
  const timeoutMs = opts.timeoutMs ?? 8000
  const maxBytes = opts.maxBytes ?? 2_000_000
  const maxRedirects = opts.maxRedirects ?? 3
  const resolve: Resolver = opts.resolve ?? ((host, o, cb) => dnsLookup(host, o, cb))

  function checkUrl(raw: string): URL {
    let u: URL
    try {
      u = new URL(raw)
    } catch {
      throw new BlockedUrlError('Invalid URL')
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:')
      throw new BlockedUrlError('Only http(s) URLs')
    if (u.username || u.password) throw new BlockedUrlError('Credentials in URL')
    const port = u.port || (u.protocol === 'https:' ? '443' : '80')
    if (!ports.includes(port)) throw new BlockedUrlError('Port not allowed')
    const host = u.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host)) {
      if (!allow(host)) throw new BlockedUrlError('Address not allowed')
    } else if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost')) {
      throw new BlockedUrlError('Host not allowed')
    }
    return u
  }

  /** DNS lookup used by the socket itself: rejects if ANY resolved address is not allowed. */
  const guardedLookup = ((hostname, options, callback) => {
    const family = typeof options.family === 'number' ? options.family : undefined
    resolve(hostname, { family, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0)
      if (!addresses.length || addresses.some((a) => !allow(a.address)))
        return callback(new BlockedUrlError('Address not allowed'), '', 0)
      if (options.all) return (callback as (e: null, a: LookupAddress[]) => void)(null, addresses)
      callback(null, addresses[0]!.address, addresses[0]!.family)
    })
  }) as LookupFunction

  function requestOnce(u: URL, accept: string, signal: AbortSignal) {
    return new Promise<http.IncomingMessage>((resolve, reject) => {
      const mod = u.protocol === 'https:' ? https : http
      const req = mod.request(
        u,
        {
          method: 'GET',
          agent: false,
          lookup: guardedLookup,
          signal,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: accept,
            'Accept-Encoding': 'gzip, deflate, br',
          },
        },
        resolve,
      )
      req.on('error', reject)
      req.end()
    })
  }

  async function readBody(res: http.IncomingMessage): Promise<string> {
    if (Number(res.headers['content-length'] ?? 0) > maxBytes) {
      res.destroy()
      throw new FetchFailedError('Response too large')
    }
    const enc = String(res.headers['content-encoding'] ?? '').toLowerCase()
    let stream: Readable = res
    if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(createGunzip())
    else if (enc === 'deflate') stream = res.pipe(createInflate())
    else if (enc === 'br') stream = res.pipe(createBrotliDecompress())
    if (stream !== res) res.on('error', (e) => stream.destroy(e))
    const chunks: Buffer[] = []
    let size = 0
    try {
      for await (const chunk of stream) {
        size += (chunk as Buffer).length
        if (size > maxBytes) throw new FetchFailedError('Response too large')
        chunks.push(chunk as Buffer)
      }
    } finally {
      res.destroy()
      stream.destroy()
    }
    return Buffer.concat(chunks).toString('utf8')
  }

  return async (raw, { accept = '*/*' } = {}) => {
    const signal = AbortSignal.timeout(timeoutMs)
    let url = checkUrl(raw)
    for (let hop = 0; ; hop++) {
      const res = await requestOnce(url, accept, signal)
      const status = res.statusCode ?? 0
      const location = res.headers.location
      if (status >= 300 && status < 400 && location) {
        res.destroy()
        if (hop >= maxRedirects) throw new FetchFailedError('Too many redirects')
        url = checkUrl(new URL(location, url).toString())
        continue
      }
      const contentType = String(res.headers['content-type'] ?? '').toLowerCase()
      return { status, url: url.toString(), contentType, body: await readBody(res) }
    }
  }
}

export const safeFetch = createSafeFetch()
