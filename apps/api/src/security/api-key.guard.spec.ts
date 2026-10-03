import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard.js';

type TestRequest = {
  method: string;
  path: string;
  header: (name: string) => string | undefined;
};

const context = (method: string, path: string, headers: Record<string, string> = {}) => ({
  switchToHttp: () => ({
    getRequest: (): TestRequest => ({
      method,
      path,
      header: (name: string) => headers[name.toLowerCase()],
    }),
  }),
});

describe('ApiKeyGuard', () => {
  const original = process.env['FORGE_API_KEY'];

  afterEach(() => {
    if (original === undefined) delete process.env['FORGE_API_KEY'];
    else process.env['FORGE_API_KEY'] = original;
  });

  it('allows local development when no API key is configured', () => {
    delete process.env['FORGE_API_KEY'];
    expect(new ApiKeyGuard().canActivate(context('POST', '/api/features'))).toBe(true);
  });

  it('protects mutations when a key is configured', () => {
    process.env['FORGE_API_KEY'] = 'secret';
    expect(() => new ApiKeyGuard().canActivate(context('POST', '/api/features'))).toThrow(UnauthorizedException);
    expect(new ApiKeyGuard().canActivate(context('POST', '/api/features', { 'x-forge-api-key': 'secret' }))).toBe(true);
  });

  it('accepts bearer credentials', () => {
    process.env['FORGE_API_KEY'] = 'secret';
    expect(new ApiKeyGuard().canActivate(context('POST', '/api/features', { authorization: 'Bearer secret' }))).toBe(true);
  });

  it('protects sensitive reads as well', () => {
    process.env['FORGE_API_KEY'] = 'secret';
    expect(() => new ApiKeyGuard().canActivate(context('GET', '/api/observability/overview'))).toThrow(UnauthorizedException);
    expect(new ApiKeyGuard().canActivate(context('GET', '/api/observability/overview', { 'x-forge-api-key': 'secret' }))).toBe(true);
  });

  it('does not break the GitHub webhook endpoint', () => {
    process.env['FORGE_API_KEY'] = 'secret';
    expect(new ApiKeyGuard().canActivate(context('POST', '/api/github/webhook'))).toBe(true);
  });

  it('rejects a key with the wrong length without comparing it unsafely', () => {
    process.env['FORGE_API_KEY'] = 'secret';
    expect(() => new ApiKeyGuard().canActivate(context('POST', '/api/features', { 'x-forge-api-key': 'secre' }))).toThrow(UnauthorizedException);
  });
});
