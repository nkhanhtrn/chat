import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const outDir = resolve(root, 'reader', 'data')
const tmpDir = resolve(root, '.tmp-freedict')
const URL_DICT = 'https://download.freedict.org/dictionaries/fra-eng/0.4.1/freedict-fra-eng-0.4.1.dictd.tar.xz'
const MAX_DEF_LEN = 200

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const b64Map = {}
for (let i = 0; i < B64.length; i++) b64Map[B64[i]] = i

function decodeB64(s) { let n = 0; for (const ch of s) n = n * 64 + b64Map[ch]; return n }

// ===== Download & extract =====
mkdirSync(outDir, { recursive: true })
mkdirSync(tmpDir, { recursive: true })
const tarPath = resolve(tmpDir, 'fra-eng.tar.xz')
if (!existsSync(tarPath)) { console.log('Downloading...'); execSync(`curl -sL "${URL_DICT}" -o "${tarPath}"`) }
execSync(`tar xf "${tarPath}" -C "${tmpDir}"`)
const index = readFileSync(resolve(tmpDir, 'fra-eng', 'fra-eng.index'), 'utf8').trim().split('\n')
const compressed = readFileSync(resolve(tmpDir, 'fra-eng', 'fra-eng.dict.dz'))
const data = execSync(`python3 -c "import sys,gzip; sys.stdout.buffer.write(gzip.decompress(sys.stdin.buffer.read()))"`, { input: compressed, maxBuffer: 50 * 1024 * 1024 })

// ===== Parse =====
function extract(raw) {
  const lines = raw.split('\n').filter(Boolean)
  if (!lines.length) return null
  const first = lines[0]
  const ipaM = first.match(/\/([^/]+)\//)
  const ipa = ipaM ? ipaM[1].trim() : ''
  const posM = first.match(/<([^>]+)>/)
  const pos = posM ? posM[1].trim() : ''
  const senses = []
  for (let i = 1; i < lines.length; i++) { const m = lines[i].replace(/^\d+\.\s*/, '').trim(); if (m) senses.push(m) }
  let def = senses.join('; ').replace(/\|/g, '')
  if (def.length > MAX_DEF_LEN) def = def.slice(0, MAX_DEF_LEN - 3) + '...'
  return { ipa, pos, def }
}

const baseEntries = []
for (const line of index) {
  const parts = line.split('\t')
  const word = parts[0]
  if (word.startsWith('00database') || word.length < 2) continue
  const r = extract(data.slice(decodeB64(parts[1]), decodeB64(parts[1]) + decodeB64(parts[2])).toString('utf8'))
  if (!r || !r.def) continue
  baseEntries.push({ word: word.toLowerCase(), ipa: r.ipa, pos: r.pos, def: r.def })
}

// ===== Conjugation =====
const IRREGULAR = {
  'être': 'suis es est sommes êtes sont étais était étaient serai seras sera seront fus fut fûmes fûtes furent sois soit soyons soyez soient été étant',
  'avoir': 'ai as a avons avez ont avais avait avaient aurai auras aura auront eus eut eûmes eûtes eurent aie aies ait ayons ayez aient eu ayant',
  'aller': 'vais vas va allons allez vont allais allait allaient irai iras ira iront allai allas alla allâmes allâtes allèrent aille ailles aille allions alliez aillent allé allés allant',
  'faire': 'fais fait faisons faites font faisais faisait faisaient ferai feras fera feront fis fit fîmes fîtes firent fasse fasses fasse fassions fassiez fassent fait faits faisant',
  'pouvoir': 'peux peut pouvons pouvez peuvent pouvais pouvait pouvaient pourrai pourras pourra pourront pus put pûmes pûtes purent puisse puisses puisse puissions puissiez puissent pu',
  'vouloir': 'veux veut voulons voulez veulent voulais voulait voulaient voudrai voudras voudra voudront voulus voulut voulûtes voulurent veuille veuilles veuille voulions vouliez veuillent voulu',
  'savoir': 'sais sait savons savez savent savais savait savaient saurai sauras saura sauront sus sut sûmes sûtes surent sache saches sache sachions sachiez sachent su',
  'venir': 'viens vient venons venez viennent venais venait venaient viendrai viendras viendra viendront vins vint vînmes vîntes vinrent vienne viennes vienne venions veniez viennent venu venus venant',
  'voir': 'vois voit voyons voyez voient voyais voyait voyaient verrai verras verra verront vis vit vîmes vîtes virent voie voies voie voyions voyiez voient vu vus voyant',
  'devoir': 'dois doit devons devez doivent devais devait devaient devrai devras devra devront dus dut dûmes dûtes durent doive doives doive devions deviez doivent dû',
  'prendre': 'prends prend prenons prenez prennent prenais prenait prenaient prendrai prendras prendra prendront pris prit prîmes prîtes prirent prenne prennes prenne prenions preniez prennent pris',
  'tenir': 'tiens tient tenons tenez tiennent tenais tenait tenaient tiendrai tiendras tiendra tiendront tins tint tînmes tîntes tinrent tienne tiennes tienne tenions teniez tiennent tenu tenus',
  'dire': 'dis dit disons dites disent disais disait disaient dirai diras dira diront dis dit dîmes dîtes dirent dise dises dise disions disiez disent dit dits',
  'lire': 'lis lit lisons lisez lisent lisais lisait lisaient lirai liras lira liront lus lut lûmes lûtes lurent lise lises lise lisions lisiez lisent lu lus',
  'écrire': 'écris écrit écrivons écrivez écrivent écrivais écrivait écrivaient écrirai écriras écrira écriront écrivis écrivit écrivîmes écrivîtes écrivirent écrive écrives écrive écrivions écriviez écrivent écrit écrits',
  'mettre': 'mets met mettons mettez mettent mettais mettait mettaient mettrai mettras mettra mettront mis mit mîmes mîtes mirent mette mettes mette mettions mettiez mettent mis',
  'partir': 'pars part partons partez partent partais partait partaient partirai partiras partira partiront partis partit partîmes partîtes partirent parte partes parte partions partiez partent parti',
  'sortir': 'sors sort sortons sortez sortent sortais sortait sortaient sortirai sortiras sortira sortiront sortis sortit sortîmes sortîtes sortirent sorte sortes sorte sortions sortiez sortent sorti',
  'dormir': 'dors dort dormons dormez dorment dormais dormait dormaient dormirai dormiras dormira dormiront dormis dormit dormîmes dormîtes dormirent dorme dormes dorme dormions dormiez dorment dormi',
  'connaître': 'connais connaît connaissez connaissez connaissent connaissais connaissait connaissaient connaîtrai connaîtras connaîtra connaîtront connus connut connûmes connûtes connurent connaisse connaises connaisse connaissions connaisiez connaissent connu connus',
  'courir': 'cours court courons courez courent courais courait couraient courrai courras courra courront courus courut courûmes courûtes coururent coure coures coure courions couriez courent couru',
  'mourir': 'meurs meurt mourons mourez meurent mourais mourait mouraient mourrai mourras mourra mourront mourus mourut mourûmes mourûtes moururent meure meures meure mourions mouriez meurent mort',
  'ouvrir': 'ouvre ouvres ouvrons ouvrez ouvrent ouvrais ouvrait ouvraient ouvrirai ouvriras ouvrira ouvriront ouvris ouvrit ouvrîtes ouvrirent ouvre ouvres ouvre ouvrions ouvriez ouvrent ouvert',
  'suivre': 'suis suit suivons suivez suivent suivais suivait suivaient suivrai suivras suivra suivront suivis suivit suivîmes suivîtes suivirent suive suives suive suivions suiviez suivent suivi',
  'vivre': 'vis vit vivons vivez vivent vivais vivait vivaient vivrai vivras vivra vivront vécus vécut vécûmes vécûtes vécurent vive vives vive vivions viviez vivent vécu',
}

function modStem(stem, suffix) {
  if (suffix[0] === 'a' || suffix[0] === 'o' || suffix[0] === 'â') {
    if (stem.endsWith('c')) return stem.slice(0, -1) + 'ç'
    if (stem.endsWith('g')) return stem + 'e'
  }
  return stem
}

function conjEr(word) {
  const s = word.slice(0, -2)
  const suffs = ['e','es','e','ons','ez','ent','ais','ait','ions','iez','aient','ai','as','a','âmes','âtes','èrent','ant','é']
  const f = new Set()
  for (const su of suffs) f.add(modStem(s, su) + su)
  // future/conditional from infinitive
  for (const su of ['ai','as','a','ons','ez','ont','ais','ait','ions','iez','aient']) f.add(word + su)
  // subjunctive
  for (const su of ['e','es','e','ions','iez','ent']) f.add(modStem(s, su) + su)
  return [...f]
}

function conjIr2(word) {
  const s = word.slice(0, -2)
  const f = new Set()
  // present
  for (const su of ['is','is','it','issons','issez','issent']) f.add(s + su)
  // imperfect
  for (const su of ['issais','issait','issions','issiez','issaient']) f.add(s + su)
  // past historic
  for (const su of ['is','is','it','îmes','îtes','irent']) f.add(s + su)
  // subjunctive
  for (const su of ['isse','isses','isse','issions','issiez','issent']) f.add(s + su)
  // misc
  f.add(s + 'i')      // past participle
  f.add(s + 'issant') // present participle
  // future/conditional
  for (const su of ['ai','as','a','ons','ez','ont','ais','ait','ions','iez','aient']) f.add(word + su)
  return [...f]
}

function conjRe(word) {
  const s = word.slice(0, -2)
  const f = new Set()
  // present
  f.add(s + 's'); f.add(s); f.add(s + 'ons'); f.add(s + 'ez'); f.add(s + 'ent')
  // past participle / present participle
  f.add(s + 'u'); f.add(s + 'ant')
  // past historic
  for (const su of ['is','is','it','îmes','îtes','irent']) f.add(s + su)
  // future/conditional
  for (const su of ['ai','as','a','ons','ez','ont','ais','ait','ions','iez','aient']) f.add(word + su)
  // subjunctive
  f.add(s + 'e'); f.add(s + 'es'); f.add(s + 'ent')
  return [...f]
}

function isVerb(pos) { return pos === 'v' || pos === 'vt' || pos === 'vi' }

function conjugate(word, pos) {
  if (IRREGULAR[word]) return IRREGULAR[word].split(' ')
  if (word.endsWith('er')) return conjEr(word)
  if (word.endsWith('ir')) return conjIr2(word)
  if (word.endsWith('re')) return conjRe(word)
  return []
}

// ===== Plural =====
function pluralize(word) {
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z')) return null
  if (word.endsWith('al')) return word.slice(0, -2) + 'aux'
  if (word.endsWith('ail')) return word.slice(0, -3) + 'aux'
  if (word.endsWith('au') || word.endsWith('eu') || word.endsWith('eau')) return word + 'x'
  return word + 's'
}

// ===== Build expanded entries =====
const seen = {}
const out = []

function add(word, ipa, def) {
  const w = word.toLowerCase()
  if (seen[w] || w.length < 2) return
  seen[w] = true
  out.push({ word: w, ipa: ipa || '', def: def || '' })
}

for (const e of baseEntries) {
  add(e.word, e.ipa, e.def)

  if (isVerb(e.pos)) {
    for (const form of conjugate(e.word, e.pos)) {
      add(form, '', '(' + e.word + ') ' + e.def)
    }
  }

  if (e.pos.startsWith('n') || e.pos.startsWith('adj')) {
    const p = pluralize(e.word)
    if (p) add(p, '', '(plural of ' + e.word + ') ' + e.def)
  }
}

out.sort((a, b) => a.word < b.word ? -1 : a.word > b.word ? 1 : 0)

let output = ''
for (const e of out) output += e.word + '|' + e.ipa + '|' + e.def + '\n'

const outPath = resolve(outDir, 'fre-eng.txt')
writeFileSync(outPath, output)
execSync(`rm -rf "${tmpDir}"`)

console.log(`French dictionary: ${out.length} entries (base: ${baseEntries.length}), ${(output.length / 1024).toFixed(0)} KB → ${outPath}`)
