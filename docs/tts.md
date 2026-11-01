# Mandarin text-to-speech

`POST /api/tts` uses [Azure Speech](https://learn.microsoft.com/azure/ai-services/speech-service/)
with a Neural `zh-CN` voice. The default voice is `zh-CN-XiaoxiaoNeural`.

## Why this provider

Isolated Chinese words are the hard case: `行` can be `xíng` or `háng`, and a
context-free engine has to guess. The analysis pipeline computes the intended
reading with pypinyin (plus jieba word segmentation), so the server can hand
that reading to the synthesizer.

For short, word-like cards the SSML wraps the text in a SAPI phoneme override:

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
  <voice name="zh-CN-XiaoxiaoNeural">
    <phoneme alphabet="sapi" ph="yin2 hang2">银行</phoneme>
  </voice>
</speak>
```

Cards store `reading` as syllable-separated, numbered pinyin (`yin2 hang2`).
Tone-marked input is also accepted and converted (`yín háng` becomes
`yin2 hang2`); `ü` becomes `v` (`lǜ` becomes `lv4`), and neutral-tone syllables
get tone 5 (`xiè xie` becomes `xie4 xie5`). Syllables must be space-separated;
unspaced tone-marked pinyin cannot be segmented reliably. Longer cards are spoken as plain
text, because natural sentence prosody is better than per-word overrides.

Provider calls time out after 20 seconds (Azure) or 60 seconds (the vision
model) so a stalled request does not hang the app.

## Configuration

| Variable | Purpose |
| --- | --- |
| `AZURE_SPEECH_KEY` | Speech resource key |
| `AZURE_SPEECH_REGION` | Resource region, e.g. `westeurope` |
| `AZURE_SPEECH_VOICE` | Voice name; defaults to `zh-CN-XiaoxiaoNeural` |
| `AZURE_SSML_MODE` | `auto` (default) uses phoneme overrides for short words; `plain` disables them |

Output format is `audio-24khz-48kbitrate-mono-mp3`.

## Live spike

The phoneme syntax above follows Azure's SAPI alphabet but has **not yet been
confirmed against a live key in this environment**. To verify:

```bash
npm run check:tts
```

This writes `fixtures/audio/xing.mp3` and `fixtures/audio/sentence.mp3`. Listen
to `xing.mp3`: `行` must be `xíng`, not `háng`. If the voice rejects or ignores
the phoneme tag, set `AZURE_SSML_MODE=plain` and rely on the full-sentence
context; report the result so the SSML can be adjusted.

## Failure behavior

Audio generation is best-effort. If Azure returns an error, the card is still
saved with `audioStatus: "missing"`, and the learner can regenerate it later.
