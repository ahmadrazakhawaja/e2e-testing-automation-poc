import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const GENERATED_DIR = path.join(REPO_ROOT, 'tests/e2e/generated')

// Never readable by the model: secrets, databases, dependencies, build output, git internals.
const DENIED = [
  /^\.env/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /\.db(-journal)?$/,
  /^\.output(\/|$)/,
  /^\.nuxt/,
  /^\.e2e-agent(\/|$)/,
]

/** Resolves a model-supplied path, refusing anything outside the repo or on the deny list. */
export function resolveInRepo(relPath: string): string {
  const abs = path.resolve(REPO_ROOT, relPath)
  let real = abs
  try {
    real = realpathSync(abs) // follow symlinks so a link can't point outside the repo
  } catch {
    // Missing file: fall through and let the caller report it.
  }
  for (const candidate of [abs, real]) {
    const rel = path.relative(REPO_ROOT, candidate)
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Path is outside the repository: ${relPath}`)
    if (DENIED.some((rule) => rule.test(rel))) throw new Error(`Path is not readable: ${relPath}`)
  }
  return abs
}

export const SPEC_NAME = /^[a-z0-9][a-z0-9-]{0,60}$/

/** Generated specs can only live directly in tests/e2e/generated/<name>.spec.ts. */
export function specPath(name: string): string {
  if (!SPEC_NAME.test(name)) throw new Error(`Invalid spec name "${name}": use lowercase letters, digits and dashes`)
  return path.join(GENERATED_DIR, `${name}.spec.ts`)
}

export function toRepoRelative(abs: string): string {
  return path.relative(REPO_ROOT, abs)
}
