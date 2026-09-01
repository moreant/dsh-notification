/**
 * Single-file client + ESM host build for dsh-notification.
 *
 * The web server serves exactly one file per plugin (/plugins/dsh-notification/client.js),
 * so the client half is one CJS bundle wrapped in the ModuleLoader factory
 * handshake; @deepseek-ai/dsh-* and react stay external (the profile's healed
 * node_modules and the app's module system provide them). The host half is
 * plain ESM for Node, externalizing @deepseek-ai/dsh-* plus cordis while
 * bundling schemastery (the Loader validates Config against the schema).
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

mkdirSync('lib', { recursive: true })

const dshExternal = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-*']

const clientStoreCompat = {
  name: 'dsh-client-store-compat',
  setup(build) {
    build.onResolve({ filter: /^@deepseek-ai\/dsh-client-store$/ }, (args) => {
      if (args.namespace === 'dsh-client-store-compat') return { path: args.path, external: true }
      return { path: 'client-store-fallback', namespace: 'dsh-client-store-compat' }
    })
    build.onLoad({ filter: /.*/, namespace: 'dsh-client-store-compat' }, () => ({
      loader: 'js',
      contents: `
        let store
        try {
          store = require('@deepseek-ai/dsh-client-store')
        } catch {
          store = require('@deepseek-ai/dsh-client-runtime/client')
        }
        export const createSnapshotStore = store.createSnapshotStore
      `,
    }))
  },
}

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  sourcemap: true,
  external: dshExternal,
  logLevel: 'info',
})

await build({
  entryPoints: ['src/invariant.ts'],
  outfile: 'lib/invariant.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  sourcemap: true,
  external: dshExternal,
  logLevel: 'info',
})

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  jsx: 'automatic',
  external: [...dshExternal, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
  plugins: [clientStoreCompat],
  banner: {
    js: "window.__ModuleLoader__.load({ id: 'dsh-notification', factory: (require) => { var module = { exports: {} }; var exports = module.exports;",
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})

const clientBundle = readFileSync('lib/client.js', 'utf8')
if (!clientBundle.includes('@deepseek-ai/dsh-client-store')
  || !clientBundle.includes('@deepseek-ai/dsh-client-runtime/client')) {
  throw new Error('client bundle is missing the 0.1.2/0.1.1 snapshot-store fallback')
}

execFileSync('node_modules/.bin/tsc', ['-p', 'tsconfig.json'], { stdio: 'inherit' })
