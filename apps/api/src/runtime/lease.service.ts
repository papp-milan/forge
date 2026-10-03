import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LeaseService {
  private readonly owner = randomUUID();
  private readonly ttlMs = Math.max(
    Number(process.env['FORGE_LEASE_TTL_MS'] ?? 900_000),
    30_000,
  );

  constructor(private readonly prisma: PrismaService) {}

  async acquire(key: string): Promise<boolean> {
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const result = await this.prisma.$executeRawUnsafe(
      'INSERT INTO "RuntimeLease" ("key", "owner", "expiresAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT ("key") DO UPDATE SET "owner" = EXCLUDED."owner", "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = NOW() WHERE "RuntimeLease"."expiresAt" < NOW() OR "RuntimeLease"."owner" = EXCLUDED."owner"',
      key,
      this.owner,
      expiresAt,
    );
    return result === 1;
  }

  async release(key: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      'DELETE FROM "RuntimeLease" WHERE "key" = $1 AND "owner" = $2',
      key,
      this.owner,
    );
  }
}
