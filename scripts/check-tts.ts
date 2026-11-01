import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { synthesizeSpeech } from '../server/tts'

const CASES = [
  { name: 'xing.wav', chinese: '行', reading: 'xing2' },
  { name: 'hang.wav', chinese: '银行', reading: 'yin2 hang2' },
  {
    name: 'sentence.wav',
    chinese: '请问，洗手间在哪里？',
    reading: 'qing3 wen4， xi3 shou3 jian1 zai4 na3 li3？'
  }
]

async function main(): Promise<void> {
  await mkdir('fixtures/audio', { recursive: true })
  for (const testCase of CASES) {
    const audio = await synthesizeSpeech({ chinese: testCase.chinese, reading: testCase.reading })
    if (audio.length < 44 || audio.subarray(0, 4).toString() !== 'RIFF') {
      throw new Error(`the sidecar did not return a WAV file for "${testCase.chinese}"`)
    }
    const file = `fixtures/audio/${testCase.name}`
    await writeFile(file, audio)
    console.log(`${file}: ${audio.length} bytes (listen to confirm "${testCase.chinese}")`)
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  console.error('Is the TTS sidecar running? Start it with: npm run tts:dev')
  process.exitCode = 1
})
