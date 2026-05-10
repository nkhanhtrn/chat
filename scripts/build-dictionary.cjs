#!/usr/bin/env node

/**
 * Build an offline dictionary JSON from WordNet 3.1 + CMU Pronouncing Dictionary
 *
 * Usage:
 *   node scripts/build-dictionary.cjs
 *   node scripts/build-dictionary.cjs --out public/dictionary.json
 */

const fs = require('fs')
const path = require('path')

const DEFAULT_OUT = path.join(__dirname, '..', 'public', 'dictionary.json')

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { out: DEFAULT_OUT }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) opts.out = args[++i]
  }
  return opts
}

const POS_LABELS = {
  n: 'noun',
  v: 'verb',
  a: 'adj',
  s: 'adj',
  r: 'adv',
}

const ARPABET_TO_IPA = {
  'AA': 'ɑ', 'AE': 'æ', 'AH': 'ə', 'AO': 'ɔ', 'AW': 'aʊ', 'AY': 'aɪ',
  'EH': 'ɛ', 'ER': 'ɜr', 'EY': 'eɪ', 'IH': 'ɪ', 'IY': 'i', 'OW': 'oʊ',
  'OY': 'ɔɪ', 'UH': 'ʊ', 'UW': 'u',
  'B': 'b', 'CH': 'tʃ', 'D': 'd', 'DH': 'ð', 'F': 'f', 'G': 'ɡ',
  'HH': 'h', 'JH': 'dʒ', 'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n',
  'NG': 'ŋ', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'ʃ', 'T': 't',
  'TH': 'θ', 'V': 'v', 'W': 'w', 'Y': 'j', 'Z': 'z', 'ZH': 'ʒ',
}

function arpaToIPA(arpa) {
  return arpa.split(' ').map(function(s) {
    var stress = s.match(/\d$/)
    var base = s.replace(/\d/g, '')
    var ipa = ARPABET_TO_IPA[base] || base
    if (stress && stress[0] === '1') return 'ˈ' + ipa
    return ipa
  }).join('')
}

function parseDataFile(filePath) {
  var results = []
  var lines = fs.readFileSync(filePath, 'utf8').split('\n')

  for (var li = 0; li < lines.length; li++) {
    var line = lines[li]
    if (line.startsWith(' ')) continue

    var pipeIdx = line.indexOf('|')
    if (pipeIdx === -1) continue

    var before = line.substring(0, pipeIdx).trim()
    var def = line.substring(pipeIdx + 1).trim()
    if (!def) continue

    var parts = before.split(/\s+/)
    var ssType = parts[2]
    var wCnt = parseInt(parts[3], 16)

    var words = []
    var idx = 4
    for (var i = 0; i < wCnt; i++) {
      if (idx >= parts.length) break
      var word = parts[idx]
      idx += 2
      if (word && !word.endsWith(')')) {
        words.push(word.toLowerCase().replace(/_/g, ' '))
      }
    }

    if (words.length > 0) {
      results.push({ words: words, pos: ssType, def: def })
    }
  }

  return results
}

async function main() {
  var opts = parseArgs()

  // Load WordNet
  var dictPath
  try {
    var wn = require('wordnet-db')
    dictPath = wn.path
  } catch (e) {
    console.error('wordnet-db is not installed. Run: npm install --save-dev wordnet-db')
    process.exit(1)
  }

  // Load CMU Pronouncing Dictionary
  var pronDict = {}
  try {
    var mod = await import('cmu-pronouncing-dictionary')
    pronDict = mod.dictionary || {}
    console.log('Loaded CMU pronouncing dictionary: ' + Object.keys(pronDict).length + ' entries')
  } catch (e) {
    console.warn('cmu-pronouncing-dictionary not found, skipping pronunciations')
  }

  var files = ['data.noun', 'data.verb', 'data.adj', 'data.adv']
  var entries = {}
  var totalSynsets = 0

  for (var fi = 0; fi < files.length; fi++) {
    var filePath = path.join(dictPath, files[fi])
    if (!fs.existsSync(filePath)) {
      console.warn('Skipping ' + files[fi] + ' (not found)')
      continue
    }

    var synsets = parseDataFile(filePath)
    totalSynsets += synsets.length

    for (var si = 0; si < synsets.length; si++) {
      var synset = synsets[si]
      var posLabel = POS_LABELS[synset.pos] || synset.pos
      for (var wi = 0; wi < synset.words.length; wi++) {
        var word = synset.words[wi]
        if (!entries[word]) {
          entries[word] = {}
        }
        var posMap = entries[word]
        if (!posMap[posLabel]) {
          posMap[posLabel] = []
        }
        var defs = posMap[posLabel]
        if (defs.length < 3) {
          defs.push(synset.def.replace(/"/g, "'"))
        }
      }
    }
  }

  var result = {}
  var count = 0

  for (var entry of Object.entries(entries)) {
    var word = entry[0]
    var posMap = entry[1]
    if (!word || word.includes(' ')) continue

    var parts = []
    for (var posEntry of Object.entries(posMap)) {
      var pos = posEntry[0]
      var defs = posEntry[1]
      var formatted = defs[0].replace(/;\s*'([^']+)'/g, function(_, ex) {
        return '\n> "' + ex + '"'
      })
      parts.push('**' + pos + '** ' + formatted)
    }

    var entryObj = { d: parts.join('\n\n') }

    var arpa = pronDict[word]
    if (arpa) {
      entryObj.p = '/' + arpaToIPA(arpa) + '/'
    }

    result[word] = entryObj
    count++
  }

  var json = JSON.stringify(result)
  var sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(1)

  fs.mkdirSync(path.dirname(opts.out), { recursive: true })
  fs.writeFileSync(opts.out, json)

  var pronCount = Object.values(result).filter(function(e) { return e.p }).length
  console.log('WordNet ' + totalSynsets + ' synsets → ' + count + ' words (' + pronCount + ' with pronunciation) → ' + opts.out + ' (' + sizeMB + ' MB)')
}

main()
