# Chinese Friend

A personal web app for turning screenshots of Chinese text into audio flashcards.

1. Pick a screenshot from your phone.
2. A local OCR sidecar reads the Chinese text on your own machine.
3. Only that text is sent to a text model, which translates it, explains it, and
   writes one new simple example sentence. Pinyin is computed locally.
4. Check and edit the draft, then confirm.
5. The card gets Mandarin audio and goes into a spaced-repetition queue.

Cards live on your device. The screenshot never leaves your machine: it goes to
your own server, is read by the local OCR sidecar, and is not forwarded to any
AI provider.

## Requirements

- Node.js 22 or newer
- Python 3.11 or newer with `venv` support
- A DeepSeek API key (text only)
- Roughly 400 MB of disk for the local Kokoro TTS model (downloaded during setup)

## Setup

```bash
npm install
npm run ocr:setup   # creates ocr/.venv and installs RapidOCR + pypinyin
npm run tts:setup   # creates tts/.venv, installs Kokoro, downloads the model
cp .env.example .env
# fill in the keys in .env
npm run dev
```

`npm run dev` starts four processes: the Express API on port 3001, the Vite
client on port 5173, the OCR sidecar on port 7861, and the TTS sidecar on port
7862. Open the client URL on your phone (same network) or on your computer.

If `npm run ocr:setup` cannot find a Python with `venv` support, point it at one
explicitly:

```bash
OCR_PYTHON=/path/to/python3 npm run ocr:setup
```

The same applies to the TTS sidecar with `TTS_PYTHON`. `npm run tts:setup` tries
the hf-mirror copy first and falls back to the GitHub release when the mirror is
unreachable; `KOKORO_MIRROR_BASE_URL`, `KOKORO_MODEL_BASE_URL`,
`KOKORO_MODEL_URL`, and `KOKORO_VOICES_URL` override the sources. See
[docs/tts.md](docs/tts.md).

## Environment variables

All variables are server-side only.

| Variable | Purpose |
| --- | --- |
| `DEEPSEEK_API_KEY` | Text model key used to translate, explain, and write examples |
| `DEEPSEEK_BASE_URL` | OpenAI-compatible base URL; defaults to `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | Model id; defaults to `deepseek-chat` |
| `OCR_URL` | Local OCR sidecar; defaults to `http://127.0.0.1:7861` |
| `OCR_PORT` | Port the sidecar listens on; defaults to `7861` |
| `OCR_HOST` | Sidecar bind address; defaults to `127.0.0.1` |
| `TTS_URL` | Local Kokoro sidecar used by `/api/tts`; defaults to `http://127.0.0.1:7862` |
| `TTS_PORT` | Port the sidecar listens on; defaults to `7862` |
| `TTS_HOST` | Sidecar bind address; defaults to `127.0.0.1` |
| `TTS_VOICE` | Kokoro voice id; defaults to `zf_xiaoxiao` |
| `TTS_SPEED` | Speech rate from 0.5 to 2.0; defaults to `1` |
| `PORT` | Express port; defaults to `3001` |

Do not prefix any of these with `VITE_`; Vite exposes `VITE_*` variables to the
browser.

## Privacy

- The screenshot is sent by the browser to the Express server you run yourself,
  and no further. The OCR sidecar reads it on the same machine.
- Only the recognized Chinese text is sent to DeepSeek. The image bytes are not
  part of that request, and the API code never forwards them.
- Audio and cards stay in the browser's on-device database. The DeepSeek key
  stays on the server.
- Pronunciation audio is synthesized locally by the Kokoro sidecar; the card
  text is not sent to a text-to-speech provider.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API, client, and both sidecars together |
| `npm run ocr:setup` | Create `ocr/.venv` and install the OCR sidecar's dependencies |
| `npm run ocr:dev` | Run the OCR sidecar alone |
| `npm run tts:setup` | Create `tts/.venv`, install Kokoro, and download the model |
| `npm run tts:dev` | Run the TTS sidecar alone |
| `npm run build` | Build the client into `dist/` |
| `npm start` | Serve the built client and API from one Express process |
| `npm run typecheck` | Type-check client and server |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run check:ocr` | Read the fixture images through the running sidecar |
| `npm run icons` | Regenerate PWA icons |

## Production

```bash
npm run build
npm run ocr:dev &   # or run both under systemd/supervisor
npm run tts:dev &
npm start
```

One Express process serves the built client from `dist/` and exposes the API;
the two Python sidecars must run alongside it on the same host. Deploy all three
to any host that can run Node and Python (Render, Railway, Fly, or a VPS) with
the environment variables above, and run `npm run ocr:setup && npm run
tts:setup` once on the host. HTTPS is required for installing the PWA.

## Install and backup

Cards are stored in the browser's IndexedDB, not on the server.

- **Install:** on Chromium browsers (Chrome, Edge, Android browsers) an
  install banner appears when the app is eligible. On iPhone, open the app in
  Safari, tap Share, then **Add to Home Screen**. Installing makes the browser
  less likely to clear the site's storage.
- **Persistent storage:** the first save asks the browser not to evict card
  data. If the request is refused, the saved-card screen shows a reminder to
  keep backups.
- **Export:** tap **Export cards** at the bottom of the Capture screen. It
  downloads `chinese-friend-YYYY-MM-DD.json` containing every card's Chinese,
  pinyin, English, explanation, example sentence, reading, creation date, and
  FSRS review state. Audio is not included because it can be generated again
  with the card's **Generate audio** action.

Export a backup periodically; browser storage can still be cleared when the
site data is removed manually or the device runs out of space.
