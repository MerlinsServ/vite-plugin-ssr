export { generateImportGlobs }
export type { CrawlLocations }

import { writeFileSync } from 'fs'

type CrawlLocations = {
  include?: string[]
}

function generateImportGlobs(crawLocations?: CrawlLocations) {
  const entries = ['/']

  if (crawLocations?.include) {
    entries.push(...crawLocations.include)
  }

  const fileContent = generateFileContent()
  // Current directory: node_modules/vite-plugin-ssr/dist/cjs/node/plugin/generateImportGlobs.js
  writeFileSync(require.resolve('../../../../dist/esm/node/page-files/pageFiles.js'), fileContent)
  writeFileSync(require.resolve('../../../../dist/esm/client/page-files/pageFiles.js'), fileContent)
}

function generateFileContent() {
  return `// This file is generatead by \`plugin/generateImportGlobs.ts\`.

// Vite resolves globs with micromatch: https://github.com/micromatch/micromatch
// Pattern \`*([a-zA-Z0-9])\` is an Extglob: https://github.com/micromatch/micromatch#extglobs
export const pageFiles = {
  isOriginalFile: false,
  //@ts-ignore
  '.page': import.meta.glob('/**/*.page.*([a-zA-Z0-9])'),
  //@ts-ignore
  '.page.client': import.meta.glob('/**/*.page.client.*([a-zA-Z0-9])'),
  //@ts-ignore
  '.page.server': import.meta.glob('/**/*.page.server.*([a-zA-Z0-9])'),
  //@ts-ignore
  '.page.route': import.meta.glob('/**/*.page.route.*([a-zA-Z0-9])'),
}
`
}
