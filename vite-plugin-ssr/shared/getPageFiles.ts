import { assert, assertUsage, getPathDistance, hasProp, isBrowser, lowerFirst, notNull } from './utils'

export type { AllPageFiles }
export type { PageFile }
export { getAllPageFiles }
export { findPageFile }
export { findPageFiles }
export { findDefaultFiles }
export { findDefaultFilesSorted }
export { findDefaultFile }

export { setPageFiles }
export { setPageFilesAsync }
export { isPageFilesSet }

assertNotAlreadyLoaded()

let allPageFilesUnprocessed: AllPageFilesUnproccessed | undefined

function setPageFiles(pageFiles: unknown) {
  assert(hasProp(pageFiles, 'isOriginalFile'), 'Missing isOriginalFile')
  assert(pageFiles.isOriginalFile === false, `\`isOriginalFile === ${pageFiles.isOriginalFile}\``)
  assert(hasProp(pageFiles, '.page'))
  assert(hasProp(pageFiles, 'root', 'string'))
  allPageFilesUnprocessed = pageFiles as AllPageFilesUnproccessed
}
function isPageFilesSet() {
  return !!allPageFilesUnprocessed
}

let asyncGetter: () => Promise<unknown>
function setPageFilesAsync(getter: () => Promise<unknown>) {
  asyncGetter = getter
}

type PageFile = {
  filePath: string
  loadFile: () => Promise<Record<string, unknown>>
}
const fileTypes = ['.page', '.page.server', '.page.route', '.page.client'] as const
type FileType = typeof fileTypes[number]
type PageFileUnprocessed = Record<PageFile['filePath'], PageFile['loadFile']>
//*
type AllPageFilesUnproccessed = {
  isOriginalFile: false
  root: string
  '.page': PageFileUnprocessed
  '.page.server': PageFileUnprocessed
  '.page.route': PageFileUnprocessed
  '.page.client': PageFileUnprocessed
}
/*/
type AllPageFilesUnproccessed = Record<FileType, PageFileUnprocessed>
//*/

type AllPageFiles = Record<FileType, PageFile[]>

async function getAllPageFiles(isProduction?: boolean): Promise<AllPageFiles> {
  if (asyncGetter) {
    if (
      !allPageFilesUnprocessed ||
      // We reload all glob imports in dev to make auto-reload work
      !isProduction
    ) {
      const pageFiles = (await asyncGetter()) as unknown
      setPageFiles(pageFiles)
    }
    assert(hasProp(allPageFilesUnprocessed, '.page'))
  }
  assert(hasProp(allPageFilesUnprocessed, '.page'))
  assert(hasProp(allPageFilesUnprocessed, 'root', 'string'))
  const { root } = allPageFilesUnprocessed

  const allPageFiles = {
    '.page': processGlobResult(allPageFilesUnprocessed['.page'], root),
    '.page.route': processGlobResult(allPageFilesUnprocessed['.page.route'], root),
    '.page.server': processGlobResult(allPageFilesUnprocessed['.page.server'], root),
    '.page.client': processGlobResult(allPageFilesUnprocessed['.page.client'], root),
  }

  return allPageFiles
}

function processGlobResult(pageFiles: PageFileUnprocessed, root: string): PageFile[] {
  return Object.entries(pageFiles).map(([filePath, loadFile]) => {
    filePath = resolveFilePath(filePath, root)
    return { filePath, loadFile }
  })
}

function resolveFilePath(filePath: string, root: string): string {
  assert(!filePath.includes('\\') && !root.includes('\\'), { filePath, root })
  if (filePath.startsWith('/../')) {
    filePath = filePath.slice(1)
  }
  if (!filePath.startsWith('../')) {
    return filePath
  }
  let parentDepth = 0
  while (filePath.startsWith('../')) {
    filePath = filePath.slice(3)
    parentDepth++
  }
  filePath =
    '/' +
    ['@fs', ...root.split('/').filter(Boolean).slice(0, -parentDepth), ...filePath.split('/')].filter(Boolean).join('/')
  return filePath
}

function findPageFile<T extends { filePath: string }>(pageFiles: T[], pageId: string): T | null {
  pageFiles = pageFiles.filter(({ filePath }) => {
    assert(filePath.startsWith('/'))
    assert(pageId.startsWith('/'))
    assert(!filePath.includes('\\'))
    assert(!pageId.includes('\\'))
    return filePath.startsWith(`${pageId}.page.`)
  })
  if (pageFiles.length === 0) {
    return null
  }
  assertUsage(pageFiles.length === 1, 'Conflicting ' + pageFiles.map(({ filePath }) => filePath).join(' '))
  const pageFile = pageFiles[0]
  assert(pageFile)
  return pageFile
}

function findPageFiles<T extends { filePath: string }>(allPageFiles: T[], pageId: string): T[] {
  const pageFiles = [findPageFile(allPageFiles, pageId), ...findDefaultFilesSorted(allPageFiles, pageId)].filter(
    notNull,
  )
  return pageFiles
}

function findDefaultFiles<T extends { filePath: string }>(pageFiles: T[]): T[] {
  const defaultFiles = pageFiles.filter(({ filePath }) => {
    assert(filePath.startsWith('/'))
    assert(!filePath.includes('\\'))
    return filePath.includes('/_default')
  })

  return defaultFiles
}

function findDefaultFilesSorted<T extends { filePath: string }>(pageFiles: T[], pageId: string): T[] {
  const defaultFiles = findDefaultFiles(pageFiles)
  // Sort `_default.page.server.js` files by filesystem proximity to pageId's `*.page.js` file
  defaultFiles.sort(
    lowerFirst(({ filePath }) => {
      if (filePath.startsWith(pageId)) return -1
      return getPathDistance(pageId, filePath)
    }),
  )
  return defaultFiles
}

function assertNotAlreadyLoaded() {
  // The functionality of this file will fail if it's loaded more than
  // once; we assert that it's loaded only once.
  const alreadyLoaded = Symbol()
  const globalObject: any = isBrowser() ? window : global
  assert(!globalObject[alreadyLoaded])
  globalObject[alreadyLoaded] = true
}

function findDefaultFile<T extends { filePath: string }>(pageFiles: T[], pageId: string): T | null {
  const defaultFiles = findDefaultFilesSorted(pageFiles, pageId)
  return defaultFiles[0] || null
}
