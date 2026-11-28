import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT_DIR = resolve(import.meta.dirname, '../../..')

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(ROOT_DIR, relativePath), 'utf8')
}

test('docsSync - version de package.json sincronizada en docs/STATUS.md y CHANGELOG.md', () => {
  const pkg = JSON.parse(readRepoFile('package.json')) as { version: string }
  assert.ok(pkg.version, 'package.json debe definir version')

  const statusMd = readRepoFile('docs/STATUS.md')
  const changelogMd = readRepoFile('CHANGELOG.md')

  assert.ok(
    statusMd.includes(pkg.version),
    `docs/STATUS.md debe incluir la version actual ${pkg.version}`,
  )
  assert.ok(
    changelogMd.includes(`[${pkg.version}]`),
    `CHANGELOG.md debe incluir la seccion [${pkg.version}]`,
  )
})

test('docsSync - todas las paginas src/pages/*.tsx estan documentadas en docs/SCREENS_GUIDE.md y README.md', () => {
  const pagesDir = resolve(ROOT_DIR, 'src/pages')
  const pageFiles = readdirSync(pagesDir)
    .filter((name) => name.endsWith('.tsx'))
    .sort()

  assert.ok(pageFiles.length > 0, 'Debe existir al menos una pagina en src/pages/')

  const screensGuide = readRepoFile('docs/SCREENS_GUIDE.md')
  const readme = readRepoFile('README.md')

  for (const pageFile of pageFiles) {
    assert.ok(
      screensGuide.includes(pageFile),
      `docs/SCREENS_GUIDE.md debe mencionar ${pageFile}`,
    )
    assert.ok(
      readme.includes(pageFile),
      `README.md debe mencionar ${pageFile}`,
    )
  }
})

test('docsSync - todas las Edge Functions supabase/functions/* estan documentadas en docs/ARCHITECTURE.md y README.md', () => {
  const functionsDir = resolve(ROOT_DIR, 'supabase/functions')
  const functionDirs = readdirSync(functionsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== '_shared' &&
        !entry.name.startsWith('.'),
    )
    .map((entry) => entry.name)
    .sort()

  assert.ok(functionDirs.length > 0, 'Debe existir al menos una Edge Function en supabase/functions/')

  const architectureMd = readRepoFile('docs/ARCHITECTURE.md')
  const readme = readRepoFile('README.md')

  for (const fnName of functionDirs) {
    assert.ok(
      architectureMd.includes(fnName),
      `docs/ARCHITECTURE.md debe documentar la Edge Function ${fnName}`,
    )
    assert.ok(
      readme.includes(fnName),
      `README.md debe documentar la Edge Function ${fnName}`,
    )
  }
})
