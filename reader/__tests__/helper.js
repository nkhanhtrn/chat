import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(__dirname, '..', 'src')

function loadFiles(files) {
  let code = ''
  for (const f of files) code += readFileSync(resolve(srcDir, f), 'utf8') + '\n'
  return code
}

export function loadCore() {
  const code = loadFiles(['core.js'])
  return new Function(code + '\nreturn { escapeHtml, unwrap, openCache, cacheGet, cacheSet };')()
}

export function loadApi() {
  const code = loadFiles(['core.js', 'api.js'])
  return new Function(code + '\nreturn { saveAuth, clearAuth, fetchBooks, saveProgress, downloadBook, cacheSet, cacheGet, state };')()
}

export function loadViews() {
  const code = loadFiles(['core.js', 'api.js', 'views.js'])
  return new Function(code + '\nreturn { renderLibraryPage, flattenToc, showTocModal, renderTocPage, hideTocModal, estimateProgress, state };')()
}

export function loadInit() {
  const code = loadFiles(['core.js', 'api.js', 'views.js', 'init.js'])
  return new Function(code + '\nreturn { state };')()
}
