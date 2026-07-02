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

export function loadDict() {
  const code = loadFiles(['core.js', 'dict.js'])
  return new Function(code + '\nreturn { ensureDictionary, downloadDictionary, getDictStatus, clearDictionary, dictLookup, generateStems, _stripSuffix, _levenshtein, _fuzzyLookup, _fuzzyAccentLookup, _parseDict, _binarySearchWords, _resetDict, _makeEntry, _stripElision, _removeAccents, cacheGet, cacheSet, state };')()
}

const VIEW_FILES = ['core.js', 'api.js', 'dict.js', 'library.js', 'viewer.js', 'settings.js', 'lookup.js']

export function loadViews() {
  const code = loadFiles(VIEW_FILES)
  return new Function(code + '\nreturn { renderLibraryPage, flattenToc, showTocModal, renderTocPage, hideTocModal, estimateProgress, getFilteredBooks, normalizeSearch, showSettingsModal, hideSettingsModal, renderAllDicts, extractWord, showWordPopup, hideWordPopup, attachWordLookup, state };')()
}

export function loadInit() {
  const code = loadFiles(VIEW_FILES.concat(['init.js']))
  return new Function(code + '\nreturn { state, navigate, parseHash, router };')()
}
