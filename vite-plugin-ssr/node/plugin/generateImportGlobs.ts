export { generateImportGlobs }

import { writeFileSync } from 'fs'
import { relative } from 'path'
import { toPosixPath, assertPosixPath } from '../utils'
import type { Plugin } from 'vite'
import { getRoot } from './utils/getRoot'

function generateImportGlobs(includePageFiles: string[]): Plugin {
  return {
    name: 'vite-plugin-ssr:generateImportGlobs',
    configResolved(config) {
      const root = getRoot(config)
      generate(includePageFiles, root)
    },
  } as Plugin
}

function generate(includePageFiles: string[], root: string) {
  const entries = ['/']
  includePageFiles.forEach((includePath) => {
    const includePathRelative = relative(root, includePath)
    entries.push(includePathRelative)
  })

  const fileContent = getFileContent(entries, root)
  // Current directory: node_modules/vite-plugin-ssr/dist/cjs/node/plugin/generateImportGlobs.js
  writeFileSync(require.resolve('../../../../dist/esm/node/page-files/pageFiles.js'), fileContent)
  writeFileSync(require.resolve('../../../../dist/esm/client/page-files/pageFiles.js'), fileContent)
}

function getFileContent(entries: string[], root: string) {
  let fileContent = '// This file was generatead by `node/plugin/generateImportGlobs.ts`.'

  assertPosixPath(root)
  fileContent += '\n'
  fileContent += `
export const pageFiles = {
  isOriginalFile: false,
  root: '${root}',
  '.page': {
${entries.map((pathRoot) => getGlobs(pathRoot, 'page')).join('\n')}
  },
'.page.client': {
${entries.map((pathRoot) => getGlobs(pathRoot, 'page.client')).join('\n')}
  },
  '.page.server': {
${entries.map((pathRoot) => getGlobs(pathRoot, 'page.server')).join('\n')}
  },
  '.page.route': {
${entries.map((pathRoot) => getGlobs(pathRoot, 'page.route')).join('\n')}
  },
}
`
  fileContent += '\n'
  return fileContent
}

function getGlobs(pathRoot: string, fileSuffix: 'page' | 'page.client' | 'page.server' | 'page.route'): string {
  // Vite uses `fast-glob` which resolves globs with `micromatch`: https://github.com/micromatch/micromatch
  // Pattern \`*([a-zA-Z0-9])\` is an Extglob: https://github.com/micromatch/micromatch#extglobs
  const fileExtention = '*([a-zA-Z0-9])'
  const pathParts = [...toPosixPath(pathRoot).split('/'), '**', `*.${fileSuffix}.${fileExtention}`].filter(Boolean)
  return `    ...(import.meta.glob('/${pathParts.join('/')}')),`
}
