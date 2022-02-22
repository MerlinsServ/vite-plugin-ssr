import type { Plugin, UserConfig } from 'vite'
import type { InputOption } from 'rollup'
import { isAbsolute as pathIsAbsolute, relative as pathRelative, basename as pathFilename } from 'path'
import { assert, isObject, assertPosixPath } from '../utils'
import * as glob from 'fast-glob'
import { isSSR_config } from './utils'
import { getRoot } from './utils/getRoot'

export { build }

function build(includePageFiles: string[]): Plugin {
  let isSsrBuild: boolean | undefined
  return {
    name: 'vite-plugin-ssr:build',
    apply: 'build',
    config: (config) => {
      isSsrBuild = isSSR_config(config)
      const input = {
        ...entryPoints(config, includePageFiles),
        ...normalizeRollupInput(config.build?.rollupOptions?.input),
      }
      return {
        build: {
          outDir: getOutDir(config),
          manifest: true,
          rollupOptions: { input },
          polyfillDynamicImport: false,
        },
        //*
        ssr: { external: ['vite-plugin-ssr'] },
        /*/
        // Try Hydrogen's `noExternal: true` bundling strategy for Cloudflare Workers
        ssr: { noExternal: true },
        //*/
      }
    },
    transform: (_src, id) => {
      assert(isSsrBuild === true || isSsrBuild === false)
      return removeClientCode(isSsrBuild, id) || undefined
    },
  }
}

function removeClientCode(isSsrBuild: boolean, id: string): void | { code: string; map: { mappings: '' } } {
  if (!isSsrBuild) {
    return
  }
  if (id.includes('.page.client.')) {
    return {
      code: `throw new Error('[vite-plugin-ssr][Wrong Usage] File ${id} should not be loaded in Node.js');`,
      map: { mappings: '' },
    }
  }
}

function entryPoints(config: UserConfig, includePageFiles: string[]): Record<string, string> {
  if (isSSR_config(config)) {
    return serverEntryPoints()
  } else {
    return browserEntryPoints(config, includePageFiles)
  }
}

function serverEntryPoints(): Record<string, string> {
  // Current directory: vite-plugin-ssr/dist/cjs/node/plugin/
  const serverEntry = require.resolve('../../../../dist/esm/node/page-files/pageFiles.js')
  assert(serverEntry.endsWith('.js'))
  const entryName = pathFilename(serverEntry).replace(/\.js$/, '')
  const entryPoints = {
    [entryName]: serverEntry,
  }
  return entryPoints
}

function browserEntryPoints(config: UserConfig, includePageFiles: string[]): Record<string, string> {
  const root = getRoot(config)
  assert(pathIsAbsolute(root))

  const browserEntries: string[] = []
  ;[root, ...includePageFiles].forEach((crawlRoot) => {
    assertPosixPath(crawlRoot)
    assert(!crawlRoot.endsWith('/'))
    const entries = glob.sync(`${crawlRoot}/**/*.page.client.*([a-zA-Z0-9])`, {
      ignore: ['**/node_modules/**'],
    })
    browserEntries.push(...entries)
  })

  const entryPoints: Record<string, string> = {}
  for (const filePath of browserEntries) {
    assert(pathIsAbsolute(filePath))
    const outFilePath = pathRelativeToRoot(filePath, config)
    entryPoints[outFilePath] = filePath
  }
  return entryPoints
}

function pathRelativeToRoot(filePath: string, config: UserConfig): string {
  assert(pathIsAbsolute(filePath))
  const root = getRoot(config)
  assert(pathIsAbsolute(root))
  return pathRelative(root, filePath)
}

function getOutDir(config: UserConfig): string {
  let outDir = config.build?.outDir
  if (!outDir) {
    outDir = 'dist'
  }
  return config.build?.ssr ? `${outDir}/server` : `${outDir}/client`
}

function normalizeRollupInput(input?: InputOption): Record<string, string> {
  if (!input) {
    return {}
  }
  // Usually `input` is an oject, but the user can set it as a `string` or `string[]`
  if (typeof input === 'string') {
    input = [input]
  }
  if (Array.isArray(input)) {
    return Object.fromEntries(input.map((input) => [input, input]))
  }
  assert(isObject(input))
  return input
}
