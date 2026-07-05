import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

const buildHost = (): { host: ArgumentsHost; response: MockResponse } => {
  const response: MockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'GET', url: '/api/v1/test' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
};

const buildFilter = (isProduction = false): AllExceptionsFilter =>
  new AllExceptionsFilter({ isProduction } as AppConfigService);

describe('AllExceptionsFilter', () => {
  it('maps ValidationPipe errors to VALIDATION_ERROR with details', () => {
    const { host, response } = buildHost();
    const exception = new BadRequestException(['page must be an integer']);

    buildFilter().catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos.',
        details: ['page must be an integer'],
      },
    });
  });

  it('passes deliberate { code, message } errors through as-is', () => {
    const { host, response } = buildHost();
    const exception = new ServiceUnavailableException({
      code: 'DATABASE_UNAVAILABLE',
      message: 'La base de datos no está disponible.',
    });

    buildFilter().catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      data: null,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'La base de datos no está disponible.',
      },
    });
  });

  it('maps framework defaults to a status code and Spanish message', () => {
    const { host, response } = buildHost();

    buildFilter().catch(new NotFoundException('Cannot GET /nope'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = response.json.mock.calls[0][0];
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('El recurso solicitado no existe.');
    expect(body.error.details).toEqual({ originalMessage: 'Cannot GET /nope' });
  });

  it('hides original framework messages in production', () => {
    const { host, response } = buildHost();

    buildFilter(true).catch(new NotFoundException('Cannot GET /nope'), host);

    const body = response.json.mock.calls[0][0];
    expect(body.error.details).toBeUndefined();
  });

  it('maps unknown exceptions to INTERNAL_ERROR without leaking internals', () => {
    const { host, response } = buildHost();

    buildFilter().catch(new Error('secret stack detail'), host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const body = response.json.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('secret stack detail');
  });
});
