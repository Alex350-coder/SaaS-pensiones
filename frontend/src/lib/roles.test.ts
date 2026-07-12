import { describe, expect, test } from 'vitest';
import { messagesPath, roleHomePath } from './roles';

describe('roleHomePath', () => {
  test('maps each role to its private area', () => {
    expect(roleHomePath('CLIENT')).toBe('/app');
    expect(roleHomePath('RESTAURANT_ADMIN')).toBe('/panel');
    expect(roleHomePath('SUPER_ADMIN')).toBe('/admin');
  });
});

describe('messagesPath', () => {
  test('returns the chat route for chat-capable roles', () => {
    expect(messagesPath('CLIENT')).toBe('/app/mensajes');
    expect(messagesPath('RESTAURANT_ADMIN')).toBe('/panel/mensajes');
  });

  test('returns null for Super Admin (no chat)', () => {
    expect(messagesPath('SUPER_ADMIN')).toBeNull();
  });
});
