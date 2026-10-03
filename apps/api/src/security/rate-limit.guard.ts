import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastCleanup = 0;
  private readonly maxBuckets = 10_000;

  canActivate(context: ExecutionContext): boolean {
    const limit = Number(process.env['FORGE_RATE_LIMIT_PER_MINUTE'] ?? 300);
    if (!Number.isFinite(limit) || limit <= 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (request.path === '/api/github/webhook') return true;

    const now = Date.now();
    const windowMs = 60_000;
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    let bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - bucket.count));
    response.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > limit) {
      throw new HttpException('Rate limit exceeded. Try again later.', 429);
    }

    if (now - this.lastCleanup > windowMs || this.buckets.size > this.maxBuckets) {
      this.lastCleanup = now;
      for (const [bucketKey, value] of this.buckets) {
        if (value.resetAt <= now) this.buckets.delete(bucketKey);
      }
      if (this.buckets.size > this.maxBuckets) {
        const oldest = [...this.buckets.entries()]
          .sort(([, left], [, right]) => left.resetAt - right.resetAt)
          .slice(0, this.buckets.size - this.maxBuckets);
        for (const [bucketKey] of oldest) this.buckets.delete(bucketKey);
      }
    }

    return true;
  }
}
