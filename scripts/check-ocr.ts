import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pinyinWith, recognizeWith } from '../server/ocr'

const OCR_URL = (process.env.OCR_URL ?? 'http://127.0.0.1:7861').replace(/\/$/, '')

const IMAGE_CASES = [
  {
    file: 'sentence.png',
    expectedText: '洗手间',
    expectedReading: 'xi3 shou3 jian1'
  },
  {
    file: 'polyphone.png',
    expectedText: '银行',
    expectedReading: 'yin2 hang2'
  },
  {
    file: 'no-chinese.png',
    expectedText: '',
    expectedReading: ''
  }
]

const PINYIN_CASES = [
  { text: '银行', reading: 'yin2 hang2' },
  { text: '行长', reading: 'hang2 zhang3' },
  { text: '音乐', reading: 'yin1 yue4' }
]

let failures = 0

function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ok: ${message}`)
  } else {
    failures += 1
    console.error(`  FAIL: ${message}`)
  }
}

async function main(): Promise<void> {
  console.log(`Checking the OCR sidecar at ${OCR_URL}`)

  for (const testCase of IMAGE_CASES) {
    const data = (await readFile(path.join('fixtures', testCase.file))).toString('base64')
    console.log(`\n${testCase.file}`)
    try {
      const result = await recognizeWith(fetch, OCR_URL, { mimeType: 'image/png', data })
      console.log(`  text:    ${JSON.stringify(result.chinese)}`)
      console.log(`  pinyin:  ${result.pinyin}`)
      console.log(`  reading: ${result.reading}`)
      check(
        testCase.expectedText === ''
          ? result.chinese === ''
          : result.chinese.includes(testCase.expectedText),
        testCase.expectedText === ''
          ? 'no Chinese text is reported'
          : `recognizes ${testCase.expectedText}`
      )
      if (testCase.expectedReading) {
        check(result.reading.includes(testCase.expectedReading), `reading contains ${testCase.expectedReading}`)
      }
    } catch (error) {
      failures += 1
      console.error('  FAIL: sidecar request failed', error)
    }
  }

  console.log('\npinyin')
  for (const testCase of PINYIN_CASES) {
    const result = await pinyinWith(fetch, OCR_URL, testCase.text)
    console.log(`  ${testCase.text} -> ${result.reading}`)
    check(result.reading === testCase.reading, `${testCase.text} reads ${testCase.reading}`)
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nAll OCR checks passed.')
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
