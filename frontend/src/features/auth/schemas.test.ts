import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './schemas';

describe('loginSchema', () => {
  it('accepts a valid email + password and trims the email', () => {
    const parsed = loginSchema.parse({ email: '  a@b.com ', password: 'pw' });
    expect(parsed.email).toBe('a@b.com');
  });

  it('rejects a malformed email', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'pw' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  const base = {
    fullName: 'Ada Lovelace',
    email: 'a@b.com',
    role: 'CLIENT' as const,
    password: 'supersecret',
    confirmPassword: 'supersecret',
  };

  it('accepts a valid registration, phone optional', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, phone: '' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, phone: '+51 999 888' }).success).toBe(true);
  });

  it('rejects a too-short name', () => {
    expect(registerSchema.safeParse({ ...base, fullName: 'A' }).success).toBe(false);
  });

  it('rejects a password under 8 characters', () => {
    const r = registerSchema.safeParse({ ...base, password: 'short', confirmPassword: 'short' });
    expect(r.success).toBe(false);
  });

  it('rejects a password over 72 bytes', () => {
    const long = 'a'.repeat(73);
    const r = registerSchema.safeParse({ ...base, password: long, confirmPassword: long });
    expect(r.success).toBe(false);
  });

  it('flags a confirmPassword mismatch on the confirm field', () => {
    const r = registerSchema.safeParse({ ...base, confirmPassword: 'different1' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('confirmPassword');
    }
  });

  it('rejects an unknown role', () => {
    expect(registerSchema.safeParse({ ...base, role: 'SUPER_ADMIN' }).success).toBe(false);
  });

  it('rejects a malformed phone', () => {
    expect(registerSchema.safeParse({ ...base, phone: 'abc' }).success).toBe(false);
  });
});
