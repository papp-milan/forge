import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard.js';

describe('ApiKeyGuard', () => {
  const original = process.env['FORGE_API_KEY'];
  afterEach(() => {
    if (original === undefined) delete process.env['FORGE_API_KEY'];
    else process.env['FORGE_API_KEY'] = original;
  });

  const context = (method: string, path: string, headers: Record<string, string> = {}) => ({
    switchToHttp: () => ({ getRequest: () => ({ method, path, header: (name: string) => headers[name.toLowerCase()] }) }),
  }) as any;

  it('allows local development when no API key is configured', () => {
    delete process.env['FORGE_API_KEY'];
    expect(new ApiKeyGuard().canActivate(context('POST', '/api/features'))).toBe(true);
  });

  it('protects mutations when a key is configured', () => {
    process.env['FORGE_API_KEY'] = 'secret';
    expect(() => new ApiKeyGuard().canActivate(context('POST', '/api/features'))).toThrow(UnauthorizedException);
    expect(new ApiKeyGuard().canActivate(context('POST', '/api/features', {'x-forge-api-key': 'secret'}))).toBe(true);
  });

  it('protects sensitive reads as well', () => {
    process.env['FORGE_API_KEY'] = 'secret';
    expect(() => new ApiKeyGuard().canActivate(context('GET', '/api/observability/overview'))).toThrow(UnauthorizedException);
    expect(new ApiKeyGuard().canActivate(context('GET', '/api/observability/overview', {'x-forge-api-key': 'secret'}))).toBe(true);
  });
});
