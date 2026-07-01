import { cpSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const src = resolve(root, 'reader')
const out = resolve(root, 'dist-reader')

rmSync(out, { recursive: true, force: true })
cpSync(src, out, { recursive: true })

console.log('Reader copied to', out)
