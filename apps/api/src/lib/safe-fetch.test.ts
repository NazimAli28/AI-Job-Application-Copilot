import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  BlockedUrlError,
  FetchFailedError,
  createSafeFetch,
  isPublicAddress,
  safeFetch,
} from './safe-fetch'

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '64:ff9b::7f00:1',
    '::ffff:0:7f00:1', // SIIT IPv4-translated
    'not-an-ip',
  ])('blocks %s', (ip) => expect(isPublicAddress(ip)).toBe(false))

  it.each(['8.8.8.8', '104.18.0.1', '2606:4700::1111'])('allows %s', (ip) =>
    expect(isPublicAddress(ip)).toBe(true),
  )
})

describe('safeFetch URL checks (no network)', () => {
  it.each([
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://2130706433/', // 127.0.0.1 as a decimal
    'http://0x7f.1/', // 127.0.0.1 in hex shorthand
    'http://[::ffff:127.0.0.1]/',
    'http://localhost/',
    'http://api.localhost/',
    'http://intranet/',
    'ftp://example.com/file',
    'file:///etc/passwd',
    'http://user:pw@example.com/',
    'http://example.com:22/',
    'not a url',
  ])('rejects %s', async (url) => {
    await expect(safeFetch(url)).rejects.toBeInstanceOf(BlockedUrlError)
  })
})

describe('safeFetch against a local server', () => {
  let server: Server
  let port = 0
  const big = 'x'.repeat(5000)
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/ok') return res.end('<html>hello</html>')
      if (req.url === '/gzip') {
        res.setHeader('Content-Encoding', 'gzip')
        return res.end(gzipSync('compressed hello'))
      }
      if (req.url === '/bomb') {
        res.setHeader('Content-Encoding', 'gzip')
        return res.end(gzipSync(big))
      }
      if (req.url === '/big') return res.end(big)
      if (req.url === '/to-metadata') {
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' })
        return res.end()
      }
      if (req.url === '/to-ok') {
        res.writeHead(301, { Location: '/ok' })
        return res.end()
      }
      if (req.url === '/loop') {
        res.writeHead(302, { Location: '/loop' })
        return res.end()
      }
      res.statusCode = 404
      res.end()
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    port = (server.address() as AddressInfo).port
  })
  afterAll(() => new Promise((r) => server.close(r)))

  const loopbackOk = () =>
    createSafeFetch({
      allowAddress: (ip) => ip === '127.0.0.1',
      ports: [String(port)],
      maxBytes: 1000,
    })
  const base = () => `http://127.0.0.1:${port}`

  it('fetches, decompresses and follows safe redirects', async () => {
    const f = loopbackOk()
    expect((await f(`${base()}/ok`)).body).toContain('hello')
    expect((await f(`${base()}/gzip`)).body).toBe('compressed hello')
    const r = await f(`${base()}/to-ok`)
    expect(r.url).toBe(`${base()}/ok`)
    expect(r.status).toBe(200)
  })

  it('caps the body size, also after decompression', async () => {
    const f = loopbackOk()
    await expect(f(`${base()}/big`)).rejects.toBeInstanceOf(FetchFailedError)
    await expect(f(`${base()}/bomb`)).rejects.toBeInstanceOf(FetchFailedError)
  })

  it('re-validates every redirect hop and limits redirects', async () => {
    const f = loopbackOk()
    await expect(f(`${base()}/to-metadata`)).rejects.toBeInstanceOf(BlockedUrlError)
    await expect(f(`${base()}/loop`)).rejects.toBeInstanceOf(FetchFailedError)
  })

  it('checks the resolved address at connect time (DNS rebinding)', async () => {
    // A public-looking name that resolves to loopback must be refused…
    const resolve = createSafeFetch({
      ports: [String(port)],
      resolve: (_h, _o, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]),
    })
    await expect(resolve(`http://jobs.example.com:${port}/ok`)).rejects.toBeInstanceOf(
      BlockedUrlError,
    )
    // …and when allowed, the connection goes to exactly the validated address.
    const pinned = createSafeFetch({
      ports: [String(port)],
      allowAddress: (ip) => ip === '127.0.0.1',
      resolve: (_h, _o, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]),
    })
    expect((await pinned(`http://jobs.example.com:${port}/ok`)).body).toContain('hello')
    // Mixed answers (one public, one private) are refused as a whole.
    const mixed = createSafeFetch({
      ports: [String(port)],
      resolve: (_h, _o, cb) =>
        cb(null, [
          { address: '8.8.8.8', family: 4 },
          { address: '127.0.0.1', family: 4 },
        ]),
    })
    await expect(mixed(`http://jobs.example.com:${port}/ok`)).rejects.toBeInstanceOf(
      BlockedUrlError,
    )
  })
})
