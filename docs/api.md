# API

Both endpoints are served by the Express process. The DeepSeek key stays on the
server; the browser never receives it.

`POST /api/analyze` depends on the local OCR sidecar (`npm run ocr:dev`), which
reads the image on the same machine; only the recognized Chinese text is sent
to DeepSeek. `POST /api/tts` depends on the local Kokoro TTS sidecar
(`npm run tts:dev`) and makes no external request.

Errors use one shape:

```json
{ "error": { "code": "INVALID_REQUEST", "message": "..." } }
```

## POST /api/analyze

Reads a screenshot locally and returns a draft card. The image is never sent to
an AI provider.

**Request** (`application/json`):

```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

- Supported image types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
- The data URL must be at most 8,000,000 characters; the request body is
  capped at 12 MB by the JSON parser.

**Response** `200`:

```json
{
  "chinese": "请问，洗手间在哪里？",
  "pinyin": "qǐng wèn， xǐ shǒu jiān zài nǎ lǐ？",
  "english": "Excuse me, where is the restroom?",
  "explanation": "A polite way to ask where the restroom is.",
  "exampleChinese": "洗手间在那边。",
  "examplePinyin": "xǐ shǒu jiān zài nà biān。",
  "exampleEnglish": "The restroom is over there.",
  "reading": "qing3 wen4， xi3 shou3 jian1 zai4 na3 li3？"
}
```

`chinese`, `pinyin`, and `reading` come from local OCR and pypinyin; `english`,
`explanation`, `exampleChinese`, and `exampleEnglish` come from the text model.
`examplePinyin` is computed locally from `exampleChinese`.

`reading` is syllable-separated, numbered pinyin and is what the TTS endpoint
speaks. It carries the intended pronunciation of polyphonic characters, so the
speech engine does not have to guess.

**Errors**

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Body is missing `image` or is over the cap |
| 400 | `INVALID_IMAGE` | `image` is not a supported image data URL |
| 415 | `UNSUPPORTED_CONTENT_TYPE` | Request is not `application/json` |
| 422 | `NO_CHINESE_TEXT` | OCR found no Chinese text in the image |
| 502 | `OCR_FAILED` | The local sidecar returned an error or unreadable output |
| 502 | `ANALYSIS_FAILED` | The AI provider failed or returned unreadable output |
| 503 | `OCR_UNAVAILABLE` | The local OCR sidecar is not running |
| 503 | `ANALYSIS_NOT_CONFIGURED` | `DEEPSEEK_API_KEY` is not set |

**Example**

```bash
IMAGE=$(base64 -w0 fixtures/sentence.png)
curl -s http://localhost:3001/api/analyze \
  -H 'Content-Type: application/json' \
  -d "{\"image\":\"data:image/png;base64,$IMAGE\"}"
```

This needs the OCR sidecar (`npm run ocr:dev`) running and a valid
`DEEPSEEK_API_KEY`.

## POST /api/tts

See [tts.md](tts.md) for the model and pronunciation details. The contract is
documented here.

**Request** (`application/json`):

```json
{ "chinese": "行", "reading": "xing2" }
```

**Response** `200`: `audio/wav` bytes (24 kHz, mono, 16-bit).

**Errors**

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Body is missing `chinese` or `reading` |
| 415 | `UNSUPPORTED_CONTENT_TYPE` | Request is not `application/json` |
| 503 | `TTS_UNAVAILABLE` | The local TTS sidecar is not running |
| 502 | `TTS_FAILED` | The sidecar failed or returned no audio |

**Example**

```bash
curl -s http://localhost:3001/api/tts \
  -H 'Content-Type: application/json' \
  -d '{"chinese":"行","reading":"xing2"}' \
  -o xing.wav
```

This needs the TTS sidecar (`npm run tts:dev`) running and its model
downloaded (`npm run tts:setup`).
