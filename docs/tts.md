# Mandarin text-to-speech

`POST /api/tts` is served by a local Python sidecar running
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) on ONNX Runtime. The
default Chinese voice is `zf_xiaoxiao`; output is 24 kHz mono WAV. There is no
API key, account, or third-party request once the model has been downloaded.

## Why a local sidecar

- Free and Apache-2.0 licensed, with no per-character billing.
- Pronunciation can be driven from the card's stored `reading` instead of
  letting a context-free engine guess.
- Audio is synthesized on the learner's own machine, so the card text is not
  sent to a TTS provider. (During capture, the recognized Chinese text still
  goes to DeepSeek for translation and explanation.)

Kokoro's Mandarin voices are less refined than commercial neural voices; the
model card grades them lower than the English voices. They are intelligible and
tone-correct, which is what a personal flashcard tool needs. Change `TTS_VOICE`
to compare the eight built-in voices.

## Pronunciation control

Cards store `reading` as syllable-separated, numbered pinyin (`yin2 hang2`).
The sidecar converts each syllable to IPA with `misaki.zh.ZHG2P.py2ipa` and
hands the phoneme string to `kokoro.create(..., is_phonemes=True)`. This means
an isolated `行` with reading `xing2` is spoken `xíng`, and `银行` with
`yin2 hang2` is spoken `yínháng`, without relying on the model to disambiguate.

Tone-marked input is accepted and converted server-side (`yín háng` becomes
`yin2 hang2`); `ü` becomes `v` (`lǜ` becomes `lv4`), and neutral-tone syllables
get tone 5 (`xiè xie` becomes `xie4 xie5`). Syllables must be space-separated.

Chinese punctuation is mapped to the ASCII punctuation Kokoro understands
before conversion. If the reading is missing or a syllable cannot be converted,
the sidecar falls back to Kokoro's Chinese text front end (jieba + pypinyin).
That is acceptable for sentences but may guess wrong on a single polyphonic
character; editing `reading` and regenerating is the correction path.

## Model and voice

- Model: Kokoro-82M, `kokoro-v1.0.onnx` with `voices-v1.0.bin`.
- Sample rate: 24 kHz, mono, 16-bit WAV.
- Default voice: `zf_xiaoxiao`.
- Other Chinese voices: `zf_xiaobei`, `zf_xiaoni`, `zf_xiaoyi`,
  `zm_yunjian`, `zm_yunxi`, `zm_yunxia`, `zm_yunyang`.
- `npm run tts:setup` downloads roughly 400 MB of model files into
  `tts/models/` on first run. The files are gitignored.

The sidecar loads the model at startup and exits with a clear message if the
files are missing. It needs the espeak-ng shared library through
`espeakng-loader`; if startup reports that the library cannot be loaded,
install `espeak-ng` and try again.

## Configuration

| Variable | Purpose |
| --- | --- |
| `TTS_URL` | Sidecar URL used by the Express server; defaults to `http://127.0.0.1:7862` |
| `TTS_HOST` | Sidecar bind address; defaults to `127.0.0.1` |
| `TTS_PORT` | Sidecar port; defaults to `7862` |
| `TTS_VOICE` | Kokoro voice id; defaults to `zf_xiaoxiao` |
| `TTS_SPEED` | Speech rate from 0.5 to 2.0; defaults to `1` |
| `TTS_MODEL_DIR` | Directory holding the model files; defaults to `tts/models` |

Setup-time overrides for slow or mirrored downloads:

| Variable | Purpose |
| --- | --- |
| `KOKORO_MIRROR_BASE_URL` | Primary mirror base URL; defaults to the hf-mirror copy |
| `KOKORO_MODEL_BASE_URL` | Fallback GitHub release base URL for both files |
| `KOKORO_MODEL_URL` | Full URL for `kokoro-v1.0.onnx` (disables fallback) |
| `KOKORO_VOICES_URL` | Full URL for `voices-v1.0.bin` (disables fallback) |
| `TTS_PYTHON` | Python binary used to create `tts/.venv` |

`npm run tts:setup` tries the hf-mirror copy first and automatically falls back
to the canonical GitHub release when the mirror is unreachable or slow.

For example, with a mirror:

```bash
KOKORO_MODEL_BASE_URL=https://mirror.example/kokoro npm run tts:setup
```

## Live spike

```bash
npm run tts:setup
npm run tts:dev
npm run check:tts
```

This writes `fixtures/audio/xing.wav`, `hang.wav`, and `sentence.wav`. Listen to
`xing.wav`: `行` must be `xíng`, not `háng`; then confirm `hang.wav` is
`yínháng`. The generated files are gitignored.

## Failure behavior

Audio generation is best-effort. If the sidecar is not running, `/api/tts`
returns `503 TTS_UNAVAILABLE`; if synthesis fails it returns `502 TTS_FAILED`.
Either way the card is still saved with `audioStatus: "missing"`, and the
learner can generate or regenerate the audio later.
