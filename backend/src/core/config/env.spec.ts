import { validateEnv } from './env';

const VALID_ENV = {
  APP_DATABASE_URL: 'postgresql://app:secret@localhost:5432/pensiones',
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
