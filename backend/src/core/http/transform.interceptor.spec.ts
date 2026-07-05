import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { apiError, apiSuccess } from './api-envelope';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor();

  const context = {} as ExecutionContext;

  const run = async (value: unknown): Promise<unknown> => {
    const next: CallHandler = { handle: () => of(value) };
    return lastValueFrom(interceptor.intercept(context, next));
  };

  it('wraps plain data in a success envelope', async () => {
    await expect(run({ id: 1 })).resolves.toEqual({
      success: true,
      data: { id: 1 },
      error: null,
    });
  });

  it('normalizes undefined to null data', async () => {
    await expect(run(undefined)).resolves.toEqual(apiSuccess(null));
  });

  it('passes an existing success envelope through untouched', async () => {
    const envelope = apiSuccess({ already: 'wrapped' });

    await expect(run(envelope)).resolves.toBe(envelope);
  });

  it('passes an existing error envelope through untouched', async () => {
    const envelope = apiError('SOME_CODE', 'mensaje');

    await expect(run(envelope)).resolves.toBe(envelope);
  });
});
