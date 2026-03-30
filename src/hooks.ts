export type HookAction =
  | 'beforeCreate'
  | 'afterCreate'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeDelete'
  | 'afterDelete';

export interface HookEvent {
  action: HookAction;
  collection: string;
  data: Record<string, unknown>;
  result?: Record<string, unknown>;
  actor?: { id: string; type: 'agent' | 'human' };
}

export type HookHandler = (event: HookEvent) => Promise<void> | void;

interface Subscription {
  actions: HookAction[];
  handler: HookHandler;
}

export class HookRegistry {
  private subscriptions: Subscription[] = [];

  subscribe(action: HookAction | HookAction[], handler: HookHandler): () => void {
    const actions = Array.isArray(action) ? action : [action];
    const sub: Subscription = { actions, handler };
    this.subscriptions.push(sub);

    // Return unsubscribe function
    return () => {
      const idx = this.subscriptions.indexOf(sub);
      if (idx !== -1) {
        this.subscriptions.splice(idx, 1);
      }
    };
  }

  async run(event: HookEvent): Promise<void> {
    for (const sub of this.subscriptions) {
      if (sub.actions.includes(event.action)) {
        await sub.handler(event);
      }
    }
  }
}

// Global singleton
export const hooks = new HookRegistry();

// Default hook: block publishing via agent
hooks.subscribe('beforeUpdate', (event) => {
  if (event.collection === 'contents' && event.data.status === 'published') {
    throw new Error(
      'Cannot set status to "published" via agent. Publishing requires human approval.'
    );
  }
});
