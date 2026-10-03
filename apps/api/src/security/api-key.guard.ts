import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configuredKey = process.env['FORGE_API_KEY'];
    if (!configuredKey) return true;
    if (requestPath(context) === '/api/github/webhook') return true;

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    const path = request.path;
    const protectedRead =
      path.startsWith('/api/approvals') ||
      path.startsWith('/api/observability') ||
      path.startsWith('/api/governance') ||
      path.startsWith('/api/reconciliation') ||
      path.startsWith('/api/agents/sessions');

    if (!protectedRead && ['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

    const supplied =
      request.header('x-forge-api-key') ??
      request.header('authorization')?.replace(/^Bearer\s+/i, '');

    if (!supplied || !secureEqual(supplied, configuredKey)) {
      throw new UnauthorizedException('Valid Forge API credentials are required.');
    }
    return true;
  }
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function requestPath(context: ExecutionContext): string {
  return context.switchToHttp().getRequest<Request>().path;
}
