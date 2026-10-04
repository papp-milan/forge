import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/health')
  getHealth() {
    return { status: 'ok', service: 'forge-api', timestamp: new Date().toISOString() };
  }

  @Get('api/health/ready')
  async getReadiness() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return {
        status: 'ready',
        service: 'forge-api',
        dependencies: { database: 'ok' },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: 'forge-api',
        dependencies: { database: 'unavailable' },
      });
    }
  }
}
