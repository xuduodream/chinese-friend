import type { Card as FsrsCard } from 'ts-fsrs'
import type { Draft, Grade } from '@shared/card'

export type AudioStatus = 'ready' | 'missing' | 'generating'

export interface Card extends Draft {
  id: string
  audioBlob?: Blob
  audioStatus: AudioStatus
  createdAt: Date
  srs: FsrsCard & { lastGrade?: Grade }
}
