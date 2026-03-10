import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

export interface SetupEvent {
  type: string;
  sessionId: string;
  payload: Record<string, unknown>;
}

// Agent/CLI -> Wizard event types
export type AgentEventType =
  | 'setup:step'       // Navigate wizard to a step
  | 'setup:field'      // Update a form field value
  | 'pipeline:stage'   // Stage status change
  | 'pipeline:detail'  // Stage detail update
  | 'tier:update'      // Tier scorecard changed
  | 'enrich:progress'  // Enrichment checklist item updated
  | 'enrich:log';      // Activity log entry

// Wizard -> Agent/CLI event types
export type WizardEventType =
  | 'user:field'       // User edited a form field
  | 'user:confirm'     // User clicked Continue/Approve
  | 'user:retry'       // User clicked Retry
  | 'user:cancel';     // User cancelled

class SetupEventBus extends EventEmitter {
  private sessions = new Map<string, { createdAt: string }>();

  createSession(): string {
    const id = randomUUID();
    this.sessions.set(id, { createdAt: new Date().toISOString() });
    return id;
  }

  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  removeSession(id: string): void {
    this.sessions.delete(id);
  }

  emitEvent(event: SetupEvent): void {
    this.emit('event', event);
    this.emit(event.type, event);
  }
}

export const setupBus = new SetupEventBus();
