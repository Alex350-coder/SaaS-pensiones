import { RefreshTokenService } from '../application/refresh-token.service';
import { RefreshTokenPurgeJob } from './refresh-token-purge.job';

describe('RefreshTokenPurgeJob', () => {
  const buildJob = (
    purgeExpired: jest.Mock,
  ): { job: RefreshTokenPurgeJob } => {
    const service = { purgeExpired } as unknown as RefreshTokenService;
    return { job: new RefreshTokenPurgeJob(service) };
  };

  it('runs the purge and returns without throwing', async () => {
    const purgeExpired = jest.fn().mockResolvedValue(3);
    const { job } = buildJob(purgeExpired);

    await expect(job.run()).resolves.toBeUndefined();
    expect(purgeExpired).toHaveBeenCalledTimes(1);
  });

  it('swallows errors so a failed run cannot crash the app', async () => {
    const purgeExpired = jest.fn().mockRejectedValue(new Error('db down'));
    const { job } = buildJob(purgeExpired);
    jest.spyOn(job['logger'], 'error').mockImplementation(() => undefined);

    await expect(job.run()).resolves.toBeUndefined();
    expect(purgeExpired).toHaveBeenCalledTimes(1);
  });
});
