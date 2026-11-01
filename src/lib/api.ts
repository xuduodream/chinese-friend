import type { Draft, TtsRequest } from '@shared/card'

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function readError(response: Response): Promise<ApiError> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string }
  } | null

  return new ApiError(
    payload?.error?.code ?? 'REQUEST_FAILED',
    payload?.error?.message ?? `The request failed (${response.status}).`
  )
}

export async function analyzeImage(imageDataUrl: string): Promise<Draft> {
  let response: Response
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl })
    })
  } catch {
    throw new ApiError('NETWORK', 'Could not reach the server. Check your connection and try again.')
  }

  if (!response.ok) throw await readError(response)
  return (await response.json()) as Draft
}

export async function synthesizeAudio(input: TtsRequest): Promise<Blob> {
  let response: Response
  try {
    response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })
  } catch {
    throw new ApiError('NETWORK', 'Could not reach the server. The card is saved without audio.')
  }

  if (!response.ok) throw await readError(response)
  return await response.blob()
}
