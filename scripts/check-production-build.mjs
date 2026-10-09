import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'src')
const publicRoot = path.join(root, 'public')
const outputRoot = path.join(root, 'dist')
const localAddress = /(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\]|:(?:5173|8000|8001)(?:\/|\b))/i
const fixturePatterns = [
  /\bJordan\s+Davis\b/i,
  /\bOlivia\s+Wilson\b/i,
  /\bMaya\s+King\b/i,
  /\bjordan@example\.com\b/i,
  /\bmaya@example\.com\b/i,
  /\bolivia\s+park\b/i,
  /\badmin@clickandearn\.test\b/i,
  /\bCE-SEED-[A-Z0-9-]+\b/i,
  /\bFAKE-PAID-[A-Z0-9-]+\b/i,
  /\breceipt_jordan\.txt\b/i,
  /\bDigital Marketing Toolkit\b/i,
  /\bCreator Tax Essentials\b/i,
  /\bProduct Analytics Masterclass\b/i,
  /\bORD-\d+\b/i,
]

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  }))
  return nested.flat()
}

function localAddressIsOnlyDevFallback(relativePath, content) {
  if (relativePath === path.join('src', 'api', 'client.ts')) {
    return content.includes("import.meta.env.DEV ? 'http://127.0.0.1:8001/api' : '/api'")
      && (content.match(/127\.0\.0\.1/g) || []).length === 1
  }

  return relativePath === 'vite.config.ts'
    && content.includes("mode === 'production' && isLoopback")
    && content.includes('VITE_API_URL must not point to localhost')
}

const failures = []
const sourceFiles = [
  ...(await listFiles(sourceRoot)),
  ...(await listFiles(publicRoot)),
  path.join(root, 'index.html'),
  path.join(root, 'vite.config.ts'),
]
for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8')
  const relativePath = path.relative(root, file)
  if (localAddress.test(content) && !localAddressIsOnlyDevFallback(relativePath, content)) {
    failures.push(`${relativePath}: local development address found in frontend source`)
  }
  for (const pattern of fixturePatterns) {
    if (pattern.test(content)) failures.push(`${relativePath}: production-facing sample record matched ${pattern}`)
  }
}

const outputFiles = await listFiles(outputRoot)
for (const file of outputFiles) {
  const content = await readFile(file)
  const source = content.toString('utf8')
  if (localAddress.test(source)) {
    failures.push(`${path.relative(root, file)}: local URL or development port found in production build`)
  }
  for (const pattern of fixturePatterns) {
    if (pattern.test(source)) failures.push(`${path.relative(root, file)}: production build contains a known sample record matched ${pattern}`)
  }
}

if (failures.length) {
  console.error('Production frontend scan failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Production frontend scan passed: no local API address or known sample record is present in source or build output.')
}
