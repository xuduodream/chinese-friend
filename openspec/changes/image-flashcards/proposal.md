# Proposal

## Why

Learning Chinese depends on noticing real text you encounter — menus, subtitles, chats, articles — but turning that fleeting reading moment into something you can review and *hear* is slow: look it up, type it, translate it, and somehow remember to revisit it. A phone screenshot is already the moment of capture; this app closes the gap between that screenshot and a reviewable, pronounceable flashcard.

This is a personal, single-user tool. The goal is a capture loop fast enough to use in the moment, not a learning platform for others.

## What Changes

- A mobile-first web app (PWA) where a screenshot of Chinese text becomes a flashcard.
- Image intake from the phone's photo library or camera, with one screenshot producing one card.
- A local OCR step that extracts the Chinese text from the screenshot without sending the image to any third-party API, followed by a text-only AI call that returns the English translation, a short explanation, and a new simple example sentence.
- Pinyin, the pronunciation-safe reading, and the example's pinyin computed locally, deterministically, and offline.
- An editable draft screen that shows the proposal before the card is saved, so OCR and model errors are corrected rather than trusted.
- Text-to-speech audio generated per card and cached on the device, so the card can be heard during review.
- On-device card storage with a manual export/backup so cards survive browser storage eviction.
- Spaced-repetition review of saved cards with audio playback.
- A small server component that holds AI provider keys, plus a local Python OCR sidecar; learning data stays on the device, and screenshots never leave the learner's own machine.
- Only the recognized Chinese text may be sent to an AI provider; the source image may not.
- Non-goals for this change: user accounts or multi-user support, recording the learner's own voice, splitting one screenshot into multiple cards, offline capture (analysis requires connectivity), and native app packaging.

## Capabilities

### New Capabilities

- `card-capture`: turning a screenshot into a confirmed flashcard — image intake, local OCR, AI translation/explanation/example, editable draft, audio generation, on-device persistence, and backup export.
- `review`: working through saved cards — displaying a card, playing its audio, revealing its meaning and pinyin, and scheduling by spaced repetition.

### Modified Capabilities

None — this is a greenfield project with no existing specs.

## Impact

- New codebase; no existing behavior to migrate.
- External dependencies: a local RapidOCR sidecar (Python, ONNX Runtime) for extraction, a text-only DeepSeek API for translation/explanation/example, and one text-to-speech API for Mandarin audio.
- A small server endpoint is required to keep provider credentials off the device.
- Client storage uses the browser's on-device database; no learning-data database or user accounts.
- Deployment must be HTTPS-reachable from a phone and installable to the home screen.
