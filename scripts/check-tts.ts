import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { synthesizeSpeech } from '../server/tts'

const CASES = [
  { name: 'xing.mp3', chinese: '行', reading: 'xing2' },
  {
    name: 'sentence.mp3',
    chinese: '请问，洗手间在哪里？',
    reading: 'qing3 wen4, xi3 shou3 jian1 zai4 na3 li3?'
  }
]

async function main(): Promise<void> {
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    console.error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set to run the live check.')
    process.exitCode = 1
    return
  }

  await mkdir('fixtures/audio', { recursive: true })
  for (const testCase of CASES) {
    const audio = await synthesizeSpeech({ chinese: testCase.chinese, reading: testCase.reading })
    const file = `fixtures/audio/${testCase.name}`
    await writeFile(file, audio)
    console.log(`${file}: ${audio.length} bytes (listen to confirm "${testCase.chinese}")`)
  }
}

void main()
