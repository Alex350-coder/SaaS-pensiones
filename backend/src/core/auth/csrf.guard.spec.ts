import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { CSRF_TOKEN_COOKIE } from './cookies';

interface FakeRequest {
  method: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
}

function guardWith(isPublic = false): { guard: CsrfGuard } {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
  return { guard: new CsrfGuard(reflector) };
}

const TOKEN = 'a'.repeat(64);

function req(overrides: Partial<FakeRequest> = {}): FakeRequest {
  return {
    method: 'POST',
    headers: {},
    cookies: {},
    ...overrides,
  };
}

function ctxOf(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  it('allows safe methods without a token', () => {
    const { guard } = guardWith();
    expect(guard.canActivate(ctxOf(req({ method: 'GET' })))).toBe(true);
  });

  it('allows @Public routes without a token', () => {
    const { guard } = guardWith(true);
    expect(guard.canActivate(ctxOf(req()))).toBe(true);
  });

  it('allows Bearer-authenticated requests without a CSRF token', () => {
    const { guard } = guardWith();
    const request = req({ headers: { authorization: 'Bearer abc.def.ghi' } });
    expect(guard.canActivate(ctxOf(request))).toBe(true);
  });

  it('accepts a matching header and cookie (double-submit)', () => {
    const { guard } = guardWith();
    const request = req({
      headers: { 'x-csrf-token': TOKEN },
      cookies: { [CSRF_TOKEN_COOKIE]: TOKEN },
    });
    expect(guard.canActivate(ctxOf(request))).toBe(true);
  });

  it('rejects a mutating cookie request with no CSRF token', () => {
    const { guard } = guardWith();
    expect(() => guard.canActivate(ctxOf(req()))).toThrow(ForbiddenException);
  });

  it('rejects a header that does not match the cookie', () => {
    const { guard } = guardWith();
    const request = req({
      headers: { 'x-csrf-token': TOKEN },
      cookies: { [CSRF_TOKEN_COOKIE]: 'b'.repeat(64) },
    });
    expect(() => guard.canActivate(ctxOf(request))).toThrow(
      /CSRF_TOKEN_INVALID|no válida/,
    );
  });
});
