import { validateEnv } from './env';

const VALID_ENV = {
  APP_DATABASE_URL: 'postgresql://app:secret@localhost:5432/pensiones',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults for NODE_ENV and PORT', () => {
    const env = validateEnv(VALID_ENV);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
  });

  it('coerces PORT from string', () => {
    const env = validateEnv({ ...VALID_ENV, PORT: '8080' });

    expect(env.PORT).toBe(8080);
  });

  it('rejects a missing APP_DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/APP_DATABASE_URL/);
  });

  it('applies auth defaults (15 min access, 7 day refresh)', () => {
    const env = validateEnv(VALID_ENV);

    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() =>
      validateEnv({ ...VALID_ENV, JWT_ACCESS_SECRET: 'short' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects a non-postgresql APP_DATABASE_URL', () => {
    expect(() =>
      validateEnv({ APP_DATABASE_URL: 'mysql://root@localhost/db' }),
    ).toThrow(/postgresql/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...VALID_ENV, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });
});
