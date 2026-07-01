import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(__dirname, '..', 'src')

export function loadModule(name) {
  const code = readFileSync(resolve(srcDir, name), 'utf8')
  new Function(code)()
}

export function loadReader() {
  window.R = undefined
  const order = [
    'config.js', 'state.js', 'utils.js', 'auth.js',
    'books.js', 'login-view.js', 'library-view.js',
    'viewer-view.js', 'router.js',
  ]
  for (const f of order) loadModule(f)
  return window.R
}
