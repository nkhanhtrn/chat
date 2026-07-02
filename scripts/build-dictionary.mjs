import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dictDir = resolve(root, 'node_modules', 'wordnet-db', 'dict')
const outDir = resolve(root, 'reader', 'data')

const MAX_WORDS = 20000
const MAX_DEF_LEN = 200

if (!existsSync(dictDir)) {
  console.error('wordnet-db not found. Run: npm install')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

// 1. Parse index.sense → lemma → [{ offset, tagCnt }]
const senseRaw = readFileSync(resolve(dictDir, 'index.sense'), 'latin1')
const lemmaFreq = new Map()
const lemmaSenses = new Map()

for (const line of senseRaw.split('\n')) {
  if (!line.trim()) continue
  const parts = line.split(' ')
  const senseKey = parts[0]
  const offset = parts[1]
  const tagCnt = parseInt(parts[3] || '0', 10)

  const lemma = senseKey.split('%')[0].replace(/_/g, ' ')
  if (!lemmaSenses.has(lemma)) lemmaSenses.set(lemma, [])
  lemmaSenses.get(lemma).push({ offset, tagCnt })
  lemmaFreq.set(lemma, (lemmaFreq.get(lemma) || 0) + tagCnt)
}

// 2. Parse data files → offset → definition
const dataFiles = ['data.noun', 'data.verb', 'data.adj', 'data.adv']
const offsetDef = new Map()

for (const file of dataFiles) {
  const content = readFileSync(resolve(dictDir, file), 'latin1')
  for (const line of content.split('\n')) {
    if (!line || line[0] === ' ') continue
    const pipeIdx = line.indexOf(' | ')
    if (pipeIdx === -1) continue
    const offset = line.slice(0, 8)
    const gloss = line.slice(pipeIdx + 3).trim()
    let def = gloss.split(';')[0].replace(/"[^"]*"/g, '').trim()
    def = def.replace(/\|/g, '').replace(/\s+/g, ' ')
    if (def) offsetDef.set(offset, def)
  }
}

// 3. Build entries: word → best definition (most frequent sense)
const entries = []
for (const [lemma, senses] of lemmaSenses) {
  if (!lemma || lemma.length < 2) continue
  if (lemma.split(' ').length > 2) continue
  if (!/^[a-z]+( [a-z]+)?$/.test(lemma)) continue

  senses.sort((a, b) => b.tagCnt - a.tagCnt)
  let def = null
  for (const s of senses) {
    const d = offsetDef.get(s.offset)
    if (d) { def = d; break }
  }
  if (!def) continue
  if (def.length > MAX_DEF_LEN) def = def.slice(0, MAX_DEF_LEN - 3) + '...'

  entries.push({ word: lemma, def, freq: lemmaFreq.get(lemma) || 0 })
}

// 4. Sort by frequency desc, take top MAX_WORDS
entries.sort((a, b) => b.freq - a.freq)
const top = entries.slice(0, MAX_WORDS)

// 5. Sort alphabetically, output word|def
top.sort((a, b) => a.word < b.word ? -1 : a.word > b.word ? 1 : 0)

let output = ''
for (const e of top) {
  output += e.word + '|' + e.def + '\n'
}

const outPath = resolve(outDir, 'dict.txt')
writeFileSync(outPath, output)

console.log(`Dictionary: ${top.length} words, ${(output.length / 1024).toFixed(0)} KB → ${outPath}`)
