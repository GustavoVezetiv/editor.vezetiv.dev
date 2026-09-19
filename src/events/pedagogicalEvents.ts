export type PedagogicalEventType =
  | 'activity_started'
  | 'paste_blocked'
  | 'document_created'
  | 'document_renamed'
  | 'document_deleted'
  | 'format_applied'
  | 'hint_opened'
  | 'verification_requested'
  | 'verification_completed'
  | 'requirement_passed'
  | 'activity_completed'
  | 'preset_changed'

export interface PedagogicalEvent {
  id: string
  timestamp: string
  studentId?: string
  activityId: string
  attemptId?: string
  documentId: string
  type: PedagogicalEventType
  metadata: Record<string, unknown>
}

export function createPedagogicalEvent(
  event: Omit<PedagogicalEvent, 'id' | 'timestamp'>,
): PedagogicalEvent {
  return {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
}

// Deliberately isolated from localStorage: event persistence belongs to the future backend.
export function logPedagogicalEvent(event: PedagogicalEvent): void {
  console.info('[evento pedagógico]', event)
}
