import { toPosixPath } from '../utils'

export { resolveConfig }
export type { Config }

type Config = { pageFiles?: { include: string[] } }

function resolveConfig(configs: Config | Config[]): { includePageFiles: string[] } {
  const includePageFiles: string[] = []
  const configList = Array.isArray(configs) ? configs : [configs]
  configList.forEach((config) => {
    if (config.pageFiles) {
      includePageFiles.push(...config.pageFiles.include.map(sanitize))
    }
  })
  return { includePageFiles }
}

function sanitize(includePath: string): string {
  includePath = toPosixPath(includePath)
  if (includePath.endsWith('/')) {
    includePath = includePath.slice(0, -1)
  }
  return includePath
}
