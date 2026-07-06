import { PensionStatus } from './pension';
import { InvalidPensionTransitionError } from './pension.errors';

/** Who is driving a transition. SYSTEM = payment activation / expiration cron. */
export type PensionActor = 'CLIENT' | 'RESTAURANT_ADMIN' | 'SYSTEM';

/**
 * Actor-aware state machine (docs/roadmap.md F6):
 *   PENDING_PAYMENT → ACTIVE (full payment, SYSTEM) | CANCELLED (client/restaurant)
 *   ACTIVE          → EXPIRED (cron) | SUSPENDED | CANCELLED (restaurant)
 *   SUSPENDED       → ACTIVE (restaurant reactivates) | CANCELLED (restaurant)
 * EXPIRED / CANCELLED are terminal.
 */
const TRANSITIONS: Record<
  PensionActor,
  Partial<Record<PensionStatus, readonly PensionStatus[]>>
> = {
  CLIENT: {
    PENDING_PAYMENT: ['CANCELLED'],
  },
  RESTAURANT_ADMIN: {
    PENDING_PAYMENT: ['CANCELLED'],
    ACTIVE: ['SUSPENDED', 'CANCELLED'],
    SUSPENDED: ['ACTIVE', 'CANCELLED'],
  },
  SYSTEM: {
    PENDING_PAYMENT: ['ACTIVE'],
    ACTIVE: ['EXPIRED'],
  },
};

export function canTransition(
  actor: PensionActor,
  from: PensionStatus,
  to: PensionStatus,
): boolean {
  return (TRANSITIONS[actor][from] ?? []).includes(to);
}

export function assertTransition(
  actor: PensionActor,
  from: PensionStatus,
  to: PensionStatus,
): void {
  if (!canTransition(actor, from, to)) {
    throw new InvalidPensionTransitionError(from, to);
  }
}
