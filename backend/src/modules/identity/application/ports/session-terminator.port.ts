export const SESSION_TERMINATOR = Symbol('SESSION_TERMINATOR');

/**
 * Outbound port (owned by Identity, implemented by Communication — same
 * inversion as INVOICE_ISSUER). Lets logout and Super-Admin suspension sever a
 * user's live WebSocket sessions immediately, closing the "long-lived socket
 * outlives the access token" gap (docs/security.md §4). Optional at the
 * injection site: Identity keeps working if no realtime adapter is bound.
 */
export interface SessionTerminator {
  /** Force-disconnect every open socket belonging to the user, all namespaces. */
  disconnectUser(userId: string): void;
}
