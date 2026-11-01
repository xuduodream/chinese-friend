# Design

## Context

Greenfield project — there is no existing code or spec to build on. The constraint set that shapes everything below:

- Phone-first. The primary device is a phone, reached over HTTPS, installed to the home screen.
- Single user. No accounts, no server-side learning data.
- Provider credentials cannot ship to the browser; whatever AI calls happen must be proxied by a server.
- Screenshots routinely contain personal context (chats, notifications, account names), so the source image must never be sent to a third-party API. Only the recognized Chinese text may leave the learner's own machine.
- Pronunciation correctness matters more than synthesis novelty: the learner is hearing tones they cannot yet produce.
- The app must remain useful on a train with no signal, for review at least.

See `proposal.md` for motivation and the `card-capture` / `review` specs for required behavior.

## Goals / Non-Goals

**Goals:**

- A capture loop short enough to use in the moment: pick screenshot, check a draft, confirm, done.
- Correct pronunciation for the hard cases — isolated words with polyphonic characters.
- Extraction that keeps the screenshot on the learner's own machine.
- Review that works offline from cached cards and cached audio.
- Card data that survives browser storage pressure, or at least can be exported before it doesn't.
- One small deployment: a PWA front end served by the same small server that keeps provider credentials.

**Non-Goals:**

- Multi-user support, accounts, or sync across devices.
- Recording or scoring the learner's own voice.
- Splitting one screenshot into multiple cards.
- Native app packaging or deep OS share-sheet integration in v1.
- Retaining the original screenshot after extraction (see Decisions).
- Any server-side copy of cards.

## Decisions

### 1. PWA, not a native app

An installable web app gives one codebase, instant updates, home-screen presence, and `speech`/audio/blob APIs, with no app-store loop. The main thing native buys is share-sheet integration, and that is deferred rather than abandoned: Android's Web Share Target can be added later without changing the architecture.

*Alternatives:* native iOS/Android (better capture integration, two codebases, review overhead); a plain mobile website (no home-screen install, weaker offline story).

### 2. Vue 3 + Vite + Express, TypeScript and Tailwind

The app is split into three plain pieces in one repo: a Vue 3 single-page client built with Vite (`src/`), a small Express server (`server/`) that holds the provider keys and exposes `/api/analyze` and `/api/tts`, and a local Python OCR sidecar (`ocr/`) that the Express server calls over localhost. In production the Express process also serves the built client, so one Node service plus one Python sidecar is one deployment. This is deliberately explicit — no server/client component boundary, no auto-imports, and imports are visible in every file — because a beginner should be able to read the code and follow where each piece runs.

Client pieces are intentionally few: `vue-router` for the capture and review screens, `vite-plugin-pwa` for the manifest and service worker, Tailwind for styling. The server can run on Render, Railway, Fly, or any VPS; if a serverless host is preferred later, the same two handlers can move to platform functions without changing the client.

*Alternatives:* Next.js (one deployment, but React plus server/client component boundaries is the least beginner-readable option, and its SEO/server-rendering benefits go unused in a personal app); Nuxt 3 (Vue with one-command and one-deploy convenience, but convention-heavy and its auto-imports hide where things come from); SvelteKit (readable, smaller ecosystem).

### 3. Local OCR, then one text-only analysis call

`POST /api/analyze` receives the downscaled screenshot and forwards it to a long-lived local Python sidecar running RapidOCR on ONNX Runtime over localhost. The server keeps only recognized lines that contain Chinese characters and joins them into `chinese`; if nothing remains it returns `422 NO_CHINESE_TEXT` without calling any external API.

Only that text is sent to DeepSeek (OpenAI-compatible). The model returns `english`, `explanation`, `exampleChinese`, and `exampleEnglish` as JSON. It never receives the image, so a screenshot cannot leak surrounding personal context. `chinese` stays the OCR output rather than a model rewrite, which keeps the card anchored to what was on screen.

Pinyin, the example's pinyin, and the pronunciation-safe `reading` are computed locally with pypinyin and jieba: tone-marked pinyin for display, numbered syllable-separated pinyin for TTS. This is deterministic, works offline, costs nothing per call, and leaves the AI to translate, explain, and generate an example.

DeepSeek supports `response_format: json_object` but not a strict JSON schema, so the server validates the parsed JSON with Zod and retries once on malformed output before surfacing an error. The client never parses a model response directly.

Measured on the target machine (aarch64 Debian PRoot, Snapdragon 8 Elite): RapidOCR reads `请问，洗手间在哪里？` at 0.999 confidence and `银行` at 1.000, and correctly finds no Chinese in an English-only image — about 0.55 s per image after a 1.06 s first call, 300 MB installed with bundled models. Tesseract 5.3 `chi_sim` misread `洗手间` as `沪手辣`, so it was rejected; PaddleOCR publishes no aarch64 wheels; EasyOCR would add a multi-GB torch install.

*Alternatives:* the previous one-call multimodal Claude design (better polyphone context, but sends the screenshot to a third party — ruled out by the privacy constraint); cloud OCR plus a text model (same leak, one more vendor); Tesseract.js in the browser (keeps the image local, but the accuracy observed here is not usable); EasyOCR or PaddleOCR (unsuitable on this hardware).

### 4. TTS with pronunciation control, cached per card

`POST /api/tts` takes the card's `reading` and returns Mandarin audio. The design assumes a provider that accepts an explicit reading — Azure Neural `zh-CN` with SSML phoneme overrides taking pinyin is the primary candidate — precisely because isolated-word cards are where context-free TTS guesses wrong. If the chosen voice cannot take pinyin phonemes, the fallback is plain-text synthesis of the full `chinese` value, which is acceptable for sentences but weaker for single words; that is why the primary path matters.

The audio is stored as a blob with the card, not as a URL. Cached blobs make offline review work and avoid re-billing on replay. A regenerate action covers both wrong synthesis and missing audio.

*Alternatives:* browser `SpeechSynthesis` (free, zero infra, but voice availability and tone quality vary wildly by device and it cannot be corrected); ElevenLabs (excellent quality, no phoneme-level control needed for some cases, higher cost); OpenAI TTS (simple, good quality, instructions-only pronunciation control).

*Spike:* verify pinyin phoneme support on the chosen voice before committing to provider-specific SSML. This does not change the approach, only the request format.

### 5. IndexedDB for cards and audio, no backend database

Cards, review state, and audio blobs live in IndexedDB (accessed through Dexie). This is what makes "personal" real: the server sees an image and a sentence, never a card library. It also delivers offline review for free.

*Alternatives:* `localStorage` (too small for audio, synchronous); server database (requires accounts or a shared secret, contradicts the privacy posture); OPFS (more capable, unnecessary complexity for this size of data).

**Durability plan:** request persistent storage via `navigator.storage.persist()`, encourage home-screen install, and make export prominent. The export is JSON containing all text fields and review state; audio is excluded and regenerable.

### 6. FSRS via `ts-fsrs`

Spaced repetition is the reason the cards are useful over months. FSRS is a well-documented, actively maintained scheduler that adapts intervals from four grades, and `ts-fsrs` is a small client-side library — no server involvement.

*Alternatives:* SM-2 (simpler, less adaptive); fixed intervals (worst learning outcomes for the least design effort); Anki-style manual scheduling (no).

### 7. One image, one card, editable draft

The learner crops mentally before uploading. The draft editor is the correction layer, not a segmentation tool: text, pinyin, English, and reading are all editable, and the card is saved only after confirmation. This keeps the UI a form rather than a canvas.

### 8. Do not retain the source screenshot

Once extraction succeeds, the image is discarded. Screenshots routinely contain surrounding personal context (chats, notifications, account names), and storing them adds no review value that the extracted text does not already provide. In addition, the image is never sent to a third-party provider: it goes from the browser to the learner's own server and no further, so even the transient copy stays under their control.

### 9. Client-side image downscaling

Before it is sent to the local server, the image is resized (long edge capped around 1500–2000 px) and re-encoded as JPEG. RapidOCR does not need full-resolution phone screenshots, and this reduces upload time and memory on metered or constrained devices.

### Data model

```
Card
  id             uuid
  chinese        string   // editable OCR output
  pinyin         string   // tone-marked, computed locally
  english        string
  explanation    string   // short usage/meaning note from the AI
  exampleChinese string   // new simple sentence from the AI
  examplePinyin  string   // tone-marked, computed locally
  exampleEnglish string
  reading        string   // pronunciation-safe input for TTS
  audioBlob      Blob?    // cached Mandarin audio
  audioStatus    enum     // ready | missing | generating
  createdAt      ISO-8601
  srs            {
    due          ISO-8601
    stability    number
    difficulty   number
    reps         number
    lapses       number
    lastReview   ISO-8601?
    lastGrade    enum?    // Again | Hard | Good | Easy
  }
```

### Capture flow

```
pick/capture image
      |
      v
downscale on device
      |
      v
POST /api/analyze --image--> local RapidOCR sidecar
      |                            |
      |                            v
      |                     Chinese text only
      |                            |
      |                            v
      |                    DeepSeek (text-only)
      |                            |
      +<--- pypinyin (local) ------+
      |
      v
{ chinese, pinyin, english, explanation,
  exampleChinese, examplePinyin, exampleEnglish, reading }
      |
      v
editable draft  --discard--> (done)
      |
    confirm
      |
      +--> save card (audioStatus: generating)
      |
      +--> POST /api/tts { reading } --> cache blob (audioStatus: ready)
                                       \--> on failure: audioStatus: missing
```

### Review flow

Due cards are read from IndexedDB, sorted by `due`. Front shows Chinese only; reveal shows pinyin and English; grading calls `ts-fsrs` to compute the next due date and persists it. Audio playback is a tap-driven `Audio`/`<audio>` play, which also satisfies mobile autoplay restrictions.

## Risks / Trade-offs

- **Browser storage eviction** — iOS and Android can clear site storage. → Request persistent storage, promote home-screen install, keep export one tap away, and state the backup expectation in the UI.
- **Polyphonic characters read wrongly by TTS** — the exact failure mode this design targets. → Prefer a phoneme-capable voice and feed `reading`; allow per-card regeneration; keep `reading` editable.
- **OCR misreads on stylized, handwritten, or partial text** — screenshots are messy. → Editable draft before save; surface the recognized text with its confidence so the learner can fix it; never auto-save.
- **The OCR sidecar is down or crashes** — a second process can fail independently of the Node server. → Health check at startup, a typed `503 OCR_UNAVAILABLE` error, and the image kept for a retry rather than a lost draft.
- **Python runtime on the deployment host** — the sidecar needs Python 3.11 plus `rapidocr`, `onnxruntime`, `pypinyin`, and `jieba`. → A pinned requirements file and a start script documented in the README; the sidecar is part of the deployment, not an optional extra.
- **Extracted text still leaves the machine** — the privacy boundary is the image, not the words. → Send only the recognized Chinese text; state plainly in the README which fields are sent to DeepSeek and that no image is.
- **Model JSON drift** — `json_object` mode is not schema-enforced and can still arrive malformed or off-schema. → Server-side Zod validation, one retry, then a clean error; the client only renders validated data.
- **iOS capture friction** — no Web Share Target, so the loop is photo-library picker, not share sheet. → Design the capture button for the picker first; add Android share target later if it proves to increase usage.
- **Latency and cost per card** — local OCR plus one short text call plus TTS. → The image never leaves the machine, the text call is small and cached audio is reused; at personal volume the monthly cost stays negligible.
- **Audio unavailable offline** — a card saved while the network was down has no audio. → The review spec allows an "audio unavailable" state; regenerate when back online.
- **TTS provider lock-in** — SSML phoneme syntax is provider-specific. → Keep `/api/tts` as the single boundary and the card's `reading` provider-neutral, so the provider can be swapped without touching stored cards.
- **AI provider lock-in** — DeepSeek's OpenAI-compatible JSON mode is one vendor's dialect. → Keep the call behind `server/analyze.ts` with a provider-neutral prompt and Zod-validated output, so another text provider can replace it without changing the client or stored cards.

## Migration Plan

Greenfield: no migration. Deployment is a single Node build — the Vite client bundled into `dist/`, served by the Express process — with provider keys in server environment variables; rollback is redeploying the previous build. Because data lives on the device, a rollback never touches learner cards, and a storage-schema change must include a client-side upgrade path in Dexie.

## Open Questions

- Which exact Azure voice and SSML phoneme alphabet to use for pinyin overrides, and whether it handles every polyphone encountered — verify with a small spike before wiring `/api/tts`.
- Whether to include audio in the export file (base64) for full device-to-device restore, or keep exports text-only and regenerate audio after import. Deferred; does not affect the specs or capture/review behavior.
