import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // packages/shared ships TypeScript source — bundle it; keep real npm deps external.
  noExternal: [/^@copilot\/shared/],
})
