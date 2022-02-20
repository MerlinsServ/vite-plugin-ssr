import { assert, assertUsage, getPathDistance, hasProp, isBrowser, lowerFirst } from './utils'

export type { AllPageFiles }
export type { PageFile }
export { getAllPageFiles }
export { findPageFile }
export { findDefaultFiles }
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

  const tranform = (pageFiles: PageFileUnprocessed): PageFile[] => {
    return Object.entries(pageFiles).map(([filePath, loadFile]) => {
      return { filePath, loadFile }
    })
  }
  const allPageFiles = {
    '.page': tranform(allPageFilesUnprocessed['.page']),
    '.page.route': tranform(allPageFilesUnprocessed['.page.route']),
    '.page.server': tranform(allPageFilesUnprocessed['.page.server']),
    '.page.client': tranform(allPageFilesUnprocessed['.page.client']),
  }

  return allPageFiles
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

function findDefaultFiles<T extends { filePath: string }>(pageFiles: T[]): T[] {
  const defaultFiles = pageFiles.filter(({ filePath }) => {
    assert(filePath.startsWith('/'))
    assert(!filePath.includes('\\'))
    return filePath.includes('/_default')
  })
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
  const defautFiles = findDefaultFiles(pageFiles)

  // Sort `_default.page.server.js` files by filesystem proximity to pageId's `*.page.js` file
  defautFiles.sort(
    lowerFirst(({ filePath }) => {
      if (filePath.startsWith(pageId)) return -1
      return getPathDistance(pageId, filePath)
    }),
  )

  return defautFiles[0] || null
}
