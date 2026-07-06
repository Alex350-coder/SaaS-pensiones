/**
 * Communication domain rules. Pure: no Nest, no Prisma (lean hexagonal).
 *
 * A conversation is the 1-to-1 channel of one pension: its participants are
 * the pension's client and the owner of the pension's restaurant, and nobody
 * else — the WS room and the REST history both authorize through this single
 * function (docs/arquitectura.md §6.3: authorization is not duplicated).
 *
 * "Solo con pensión vigente" (roadmap F8): the channel is writable while the
 * commercial relationship is alive — the same LIVE set the DB partial unique
 * uses (PENDING_PAYMENT · ACTIVE · SUSPENDED). Once EXPIRED/CANCELLED the
 * conversation turns read-only: history survives, new messages do not.
 */
export const LIVE_PENSION_STATUSES = [
  'PENDING_PAYMENT',
  'ACTIVE',
  'SUSPENDED',
] as const;

export const MAX_MESSAGE_LENGTH = 2000; // mirrors the DB CHECK on messages.content

export type ParticipantSide = 'CLIENT' | 'RESTAURANT';

export interface ConversationParties {
  clientId: string;
  restaurantOwnerId: string;
}

export function participantSide(
  parties: ConversationParties,
  userId: string,
): ParticipantSide | null {
  if (userId === parties.clientId) {
    return 'CLIENT';
  }
  if (userId === parties.restaurantOwnerId) {
    return 'RESTAURANT';
  }
  return null;
}

export function isWritable(pensionStatus: string): boolean {
  return (LIVE_PENSION_STATUSES as readonly string[]).includes(pensionStatus);
}

/** Message content rule: non-blank after trim, capped at the DB CHECK limit. */
export function normalizeMessageContent(raw: string): string | null {
  const content = raw.trim();
  if (content.length === 0 || content.length > MAX_MESSAGE_LENGTH) {
    return null;
  }
  return content;
}
