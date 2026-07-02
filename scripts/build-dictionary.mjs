import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { dictionary as cmuDict } from 'cmu-pronouncing-dictionary'

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

// ===== ARPAbet → IPA =====
const ARPABET_IPA = {
  'AA0': '\u0251', 'AA1': '\u02C8\u0251', 'AA2': '\u02CC\u0251',
  'AE0': '\u00E6', 'AE1': '\u02C8\u00E6', 'AE2': '\u02CC\u00E6',
  'AH0': '\u0259', 'AH1': '\u02C8\u028C', 'AH2': '\u02CC\u028C',
  'AO0': '\u0254', 'AO1': '\u02C8\u0254', 'AO2': '\u02CC\u0254',
  'AW0': 'a\u028A', 'AW1': '\u02C8a\u028A', 'AW2': '\u02CCa\u028A',
  'AY0': 'a\u026A', 'AY1': '\u02C8a\u026A', 'AY2': '\u02CCa\u026A',
  'EH0': '\u025B', 'EH1': '\u02C8\u025B', 'EH2': '\u02CC\u025B',
  'ER0': '\u0259r', 'ER1': '\u02C8\u025Crf', 'ER2': '\u02CC\u025Cr',
  'EY0': 'e\u026A', 'EY1': '\u02C8e\u026A', 'EY2': '\u02CCe\u026A',
  'IH0': '\u026A', 'IH1': '\u02C8\u026A', 'IH2': '\u02CC\u026A',
  'IY0': 'i', 'IY1': '\u02C8i', 'IY2': '\u02CCi',
  'OW0': 'o\u028A', 'OW1': '\u02C8o\u028A', 'OW2': '\u02CCo\u028A',
  'OY0': '\u0254\u026A', 'OY1': '\u02C8\u0254\u026A', 'OY2': '\u02CC\u0254\u026A',
  'UH0': '\u028A', 'UH1': '\u02C8\u028A', 'UH2': '\u02CC\u028A',
  'UW0': 'u', 'UW1': '\u02C8u', 'UW2': '\u02CCu',
  'B': 'b', 'CH': 't\u0283', 'D': 'd', 'DH': '\u00F0', 'F': 'f',
  'G': '\u0261', 'HH': 'h', 'JH': 'd\u0292', 'K': 'k', 'L': 'l',
  'M': 'm', 'N': 'n', 'NG': '\u014B', 'P': 'p', 'R': 'r',
  'S': 's', 'SH': '\u0283', 'T': 't', 'TH': '\u03B8', 'V': 'v',
  'W': 'w', 'Y': 'j', 'Z': 'z', 'ZH': '\u0292',
}

function arpaToIpa(phonemes) {
  return phonemes.trim().split(/\s+/).map(p => ARPABET_IPA[p] || '').join('')
}

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

// 3. Build entries: word → best definition (most frequent sense) + IPA
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

  const ipa = cmuDict[lemma] ? arpaToIpa(cmuDict[lemma]) : ''
  entries.push({ word: lemma, ipa, def, freq: lemmaFreq.get(lemma) || 0 })
}

// 4. Sort by frequency desc, take top MAX_WORDS
entries.sort((a, b) => b.freq - a.freq)
const top = entries.slice(0, MAX_WORDS)

// 5. Sort alphabetically, output word|ipa|def
top.sort((a, b) => a.word < b.word ? -1 : a.word > b.word ? 1 : 0)

let output = ''
for (const e of top) {
  output += e.word + '|' + e.ipa + '|' + e.def + '\n'
}

const outPath = resolve(outDir, 'eng-eng.txt')
writeFileSync(outPath, output)

const withPron = top.filter(e => e.ipa).length
console.log(`Dictionary: ${top.length} words (${withPron} with IPA), ${(output.length / 1024).toFixed(0)} KB → ${outPath}`)
