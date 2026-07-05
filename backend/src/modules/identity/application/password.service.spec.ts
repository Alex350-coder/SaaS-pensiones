import { PasswordService } from './password.service';

// Low cost keeps the unit suite fast; production cost (12) is the default
// and is asserted separately.
const LOW_COST = 4;

describe('PasswordService', () => {
  const service = new PasswordService(LOW_COST);

  it('hashes and verifies a password', async () => {
    const hash = await service.hash('Password123!');

    expect(hash).not.toContain('Password123!');
    await expect(service.verify('Password123!', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('Password123!');

    await expect(service.verify('wrong-password', hash)).resolves.toBe(false);
  });

  it('produces distinct hashes for the same input (random salt)', async () => {
    const [first, second] = await Promise.all([
      service.hash('Password123!'),
      service.hash('Password123!'),
    ]);

    expect(first).not.toBe(second);
  });

  it('defaults to bcrypt cost 12 (docs/security.md §4)', async () => {
    const production = new PasswordService();
    const hash = await production.hash('x');

    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });
});
