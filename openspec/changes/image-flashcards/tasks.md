# Tasks

## 1. Project foundation

- [x] 1.1 Scaffold the Vue 3 + Vite client with TypeScript and Tailwind plus the Express server; verify `npm run dev` starts both the client and the server, and that lint and typecheck succeed
- [x] 1.2 Add runtime dependencies (Vue Router, vite-plugin-pwa, Dexie, ts-fsrs, Zod, Express, and the Python OCR sidecar's pinned requirements) and remove the vision provider SDK; verify a clean install and a successful production build
- [x] 1.3 Create `.env.example` with `DEEPSEEK_API_KEY`, the TTS variables, and the OCR sidecar variables plus a README section documenting them; verify the build succeeds with them set and that no provider key appears in the client bundle (grep the built output)
- [x] 1.4 Add the PWA manifest, icons, and a service worker through vite-plugin-pwa; verify the manifest is served and the app offers install to a mobile browser

## 2. Local OCR and text analysis

- [x] 2.1 Add the Python OCR sidecar: a long-lived local HTTP process wrapping RapidOCR, with a pinned requirements file, a start script, a health check, and a typed failure when it is unavailable; verify it recognizes the sentence, polyphone, and no-Chinese fixtures and reports no Chinese for the third
- [x] 2.2 Add local pinyin generation with pypinyin and jieba: tone-marked pinyin for display and a numbered, syllable-separated reading for TTS; verify 银行, 行长, and 音乐 produce the intended readings
- [x] 2.3 Implement `POST /api/analyze` as local OCR plus a text-only DeepSeek call returning `english`, `explanation`, `exampleChinese`, and `exampleEnglish`, merged with local pinyin into a schema-validated draft with one retry on malformed output and typed errors; verify unit tests cover valid output, malformed output, provider failure, no Chinese text, and an unavailable sidecar
- [x] 2.4 Add request size and content-type validation and document the endpoint and its privacy boundary in `docs/api.md`; verify the documented example returns a valid draft and that the image is never forwarded to DeepSeek

## 3. Audio API

- [x] 3.1 Spike the Kokoro Chinese voice: install the sidecar, synthesize the polyphone cases (`行` as `xing2`, `银行` as `yin2 hang2`) from `reading`, and record the chosen voice, model, and sample rate in `docs/tts.md`; verify saved sample audio reads the intended pronunciation
- [x] 3.2 Implement the local Kokoro sidecar and `POST /api/tts`: numbered reading → IPA via misaki with a Chinese-text fallback, a health check, typed unavailability/error responses, and `audio/wav`; verify unit tests cover success, provider failure, and an unavailable sidecar, and that `tts:setup` downloads the model
- [x] 3.3 Document the TTS contract and fallback behavior in `docs/api.md`; verify the documented request produces playable audio

## 4. Capture UI and local card store

- [x] 4.1 Define the Dexie schema for cards and audio blobs with an upgrade hook; verify CRUD round-trip tests for card and blob persistence
- [x] 4.2 Build screenshot intake from the photo library and camera with client-side downscaling; verify a large image is resized before upload
- [x] 4.3 Wire the analyze call into the client with loading and error states for unsupported files, images with no Chinese text, an unavailable OCR sidecar, and network failure; verify each state manually
- [x] 4.4 Build the editable draft form for every field (Chinese, pinyin, English, explanation, example Chinese/pinyin/English, reading) with confirm and discard actions; verify edits are saved into the card and discarding saves nothing
- [x] 4.5 Generate audio after confirmation, cache the blob, and expose regeneration with `audioStatus` handling; verify ready, missing, and regenerating states
- [x] 4.6 Add component tests for draft editing and the save flow across the new fields; verify the tests pass

## 5. Durability and export

- [x] 5.1 Request persistent storage on first save and add a home-screen install prompt; verify `navigator.storage.persisted()` reports true after acceptance and that storage failures surface a message
- [x] 5.2 Implement JSON export of all cards with text fields and review state; verify the exported file matches stored cards and excludes audio
- [x] 5.3 Document backup expectations (text-only export, audio is regenerated) in the README; verify the documented steps produce the described file

## 6. Review experience

- [x] 6.1 Implement due-card selection and FSRS scheduling for Again/Hard/Good/Easy grades with persistence; verify unit tests cover due selection, grading, and unchanged state when revisiting a card
- [x] 6.2 Build the review screen with a Chinese-only prompt, a reveal showing pinyin, English, explanation, and example, audio playback, grade buttons, remaining count, and the no-due state; verify each state manually
- [x] 6.3 Cache the app shell for offline use; verify stored due cards and cached audio can be reviewed with the network disabled
- [x] 6.4 Add tests for review state transitions; verify the full test suite passes

## 7. Integration and deployment

- [ ] 7.1 Run an end-to-end pass on a phone covering capture, local OCR, edit, audio, save, reload, and review; verify each scenario in the `card-capture` and `review` specs
- [ ] 7.2 Check the mobile layout and accessibility (labels, tap targets, contrast); verify with a phone viewport and an automated accessibility scan
- [ ] 7.3 Deploy the Express server (serving the built client) and the Python OCR sidecar to a host such as Render, Railway, Fly, or a VPS with server-side environment variables, and install the PWA on the phone; verify capture and review work over HTTPS
- [ ] 7.4 Finalize the README with setup, environment variables, deployment, and backup notes; verify a fresh clone can follow it to a running app

## Workflow follow-up

- Archive the change after implementation review passes and all spec scenarios are verified.
