import {
  isWritable,
  MAX_MESSAGE_LENGTH,
  normalizeMessageContent,
  participantSide,
} from './conversation-access';

describe('conversation access rules', () => {
  const parties = { clientId: 'client-1', restaurantOwnerId: 'owner-1' };

  it('resolves each participant to their side', () => {
    expect(participantSide(parties, 'client-1')).toBe('CLIENT');
    expect(participantSide(parties, 'owner-1')).toBe('RESTAURANT');
  });

  it('rejects everyone else (exit criterion F8)', () => {
    expect(participantSide(parties, 'intruder')).toBeNull();
    expect(participantSide(parties, '')).toBeNull();
  });

  it('is writable only while the pension is live', () => {
    expect(isWritable('PENDING_PAYMENT')).toBe(true);
    expect(isWritable('ACTIVE')).toBe(true);
    expect(isWritable('SUSPENDED')).toBe(true);
    expect(isWritable('EXPIRED')).toBe(false);
    expect(isWritable('CANCELLED')).toBe(false);
  });
});

describe('message content rule', () => {
  it('trims and accepts normal content', () => {
    expect(normalizeMessageContent('  hola  ')).toBe('hola');
  });

  it('rejects blank content', () => {
    expect(normalizeMessageContent('   ')).toBeNull();
    expect(normalizeMessageContent('')).toBeNull();
  });

  it('caps at the DB CHECK limit', () => {
    expect(normalizeMessageContent('a'.repeat(MAX_MESSAGE_LENGTH))).toHaveLength(
      MAX_MESSAGE_LENGTH,
    );
    expect(normalizeMessageContent('a'.repeat(MAX_MESSAGE_LENGTH + 1))).toBeNull();
  });
});
