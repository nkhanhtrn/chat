import { readFileSync, writeFileSync, cpSync, rmSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const srcDir = resolve(root, 'reader')
const outDir = resolve(root, 'dist-reader')

const MODULE_ORDER = [
  'core.js',
  'api.js',
  'dict.js',
  'library.js',
  'viewer.js',
  'settings.js',
  'lookup.js',
  'init.js',
]

// 1. Concatenate modules into main.js (wrapped in IIFE)
let js = "(function () {\n'use strict';\n\n"
for (const f of MODULE_ORDER) {
  js += readFileSync(resolve(srcDir, 'src', f), 'utf8') + '\n\n'
}
js += '})();\n'

// 2. Transform index.html: replace dev script tags with single main.js
let html = readFileSync(resolve(srcDir, 'index.html'), 'utf8')
html = html.replace(
  /<!-- @reader-modules-start -->[\s\S]*?<!-- @reader-modules-end -->/,
  '<script src="./main.js"></script>'
)

// 3. Write output
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'main.js'), js)
writeFileSync(resolve(outDir, 'index.html'), html)
cpSync(resolve(srcDir, 'styles.css'), resolve(outDir, 'styles.css'))
cpSync(resolve(srcDir, 'vendor'), resolve(outDir, 'vendor'), { recursive: true })

// 4b. Copy dictionary data
const dictSrc = resolve(srcDir, 'data', 'eng-eng.txt')
if (existsSync(dictSrc)) {
  cpSync(resolve(srcDir, 'data'), resolve(outDir, 'data'), { recursive: true })
}

console.log('Reader built to', outDir)
