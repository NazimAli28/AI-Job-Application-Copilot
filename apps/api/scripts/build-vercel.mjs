// Packs web + API into Vercel's Build Output API v3 (D24): `<repo>/.vercel/output`
//   static/            ← apps/web/dist (run `pnpm --filter web build` first)
//   functions/api.func ← apps/api/src/vercel.ts bundled to one ESM file + the native argon2 binding
//   config.json        ← routes: /api/* → function, static files, SPA fallback, headers
// Run from anywhere: `node apps/api/scripts/build-vercel.mjs` (root script `vercel-build`).
import { cpSync, existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(apiDir, '../..')
const webDist = join(root, 'apps/web/dist')
const out = join(root, '.vercel/output')
const fn = join(out, 'functions/api.func')
/** Function region: next to the Neon database (ap-southeast-1). */
const REGION = process.env.VERCEL_FUNCTION_REGION ?? 'sin1'

if (!existsSync(join(webDist, 'index.html')))
  throw new Error('Build the web app first (apps/web/dist)')
rmSync(out, { recursive: true, force: true })
mkdirSync(fn, { recursive: true })

// 1. Static site
cpSync(webDist, join(out, 'static'), { recursive: true })

// 2. API function: everything bundled except the native argon2 addon (copied below).
await build({
  entryPoints: [join(apiDir, 'src/vercel.ts')],
  outfile: join(fn, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: ['@node-rs/argon2', 'pg-native', 'pino-pretty'],
  // CommonJS dependencies inside an ESM bundle still call require()/__dirname.
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module'",
      "import { fileURLToPath as __fu } from 'node:url'",
      "import { dirname as __dn } from 'node:path'",
      'const require = __cr(import.meta.url)',
      'const __filename = __fu(import.meta.url)',
      'const __dirname = __dn(__filename)',
    ].join('\n'),
  },
  logLevel: 'warning',
})
writeFileSync(join(fn, 'package.json'), JSON.stringify({ type: 'module' }))

// 3. Native argon2: the package + whichever platform binding pnpm installed (linux-x64 on Vercel).
const apiRequire = createRequire(join(apiDir, 'package.json'))
const argonDir = realpathSync(dirname(apiRequire.resolve('@node-rs/argon2/package.json')))
cpSync(argonDir, join(fn, 'node_modules/@node-rs/argon2'), { recursive: true })
const argonRequire = createRequire(join(argonDir, 'package.json'))
const { optionalDependencies = {} } = argonRequire('./package.json')
let bindings = 0
for (const name of Object.keys(optionalDependencies)) {
  try {
    const dir = realpathSync(dirname(argonRequire.resolve(`${name}/package.json`)))
    cpSync(dir, join(fn, 'node_modules', name), { recursive: true })
    bindings++
  } catch {
    // binding for another platform — not installed
  }
}
if (!bindings) throw new Error('No @node-rs/argon2 platform binding found')

writeFileSync(
  join(fn, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      maxDuration: 60,
      regions: [REGION],
    },
    null,
    2,
  ),
)

// 4. Routing
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}
writeFileSync(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: '^/assets/(.*)$',
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        // API responses carry helmet's headers; everything else gets these.
        { src: '^/(?!api/).*$', headers: securityHeaders, continue: true },
        { src: '^/api/(.*)$', dest: '/api?__path=$1' },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
)
console.log(`Vercel output ready: ${out} (function region ${REGION}, ${bindings} argon2 binding)`)
