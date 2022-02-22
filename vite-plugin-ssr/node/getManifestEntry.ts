import { relative } from 'path/posix'
import type { ViteManifest, ViteManifestEntry } from './getViteManifest'
import { assert, assertPosixPath } from './utils'

export { getManifestEntry }

// prettier-ignore
function getManifestEntry(filePath: string, manifests: ViteManifest[], root: string, optional: false): { manifestEntry: ViteManifestEntry, manifest: ViteManifest }
// prettier-ignore
function getManifestEntry(filePath: string, manifests: ViteManifest[], root: string, optional: true): { manifestEntry: ViteManifestEntry, manifest: ViteManifest} | null
function getManifestEntry(filePath: string, manifests: ViteManifest[], root: string, optional: boolean) {
  assert(filePath.startsWith('/'))
  const manifestKey1 = filePath.slice(1)
  for (const manifest of manifests) {
    let manifestEntry = manifest[manifestKey1]
    if (manifestEntry) {
      return { manifestEntry, manifest }
    }
  }
  const manifestKey2 = resolveSymlink(filePath, root)
  for (const manifest of manifests) {
    let manifestEntry = manifest[manifestKey2]
    if (manifestEntry) {
      return { manifestEntry, manifest }
    }
  }
  assert(optional, { manifestKey1, manifestKey2 })
  return null
}

function resolveSymlink(filePath: string, root: string) {
  assertPosixPath(filePath)
  assertPosixPath(root)
  const filePathAbsolute = [...root.split('/'), ...filePath.split('/')].join('/')
  // Resolves symlinks
  const filePathResolved = require.resolve(filePathAbsolute)
  const filePathRelative = relative(root, filePathResolved)
  return filePathRelative
}
