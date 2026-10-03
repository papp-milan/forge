import { Controller, Get } from '@nestjs/common';
import { WorkforceService } from './workforce.service.js';

@Controller('api/workforce')
export class WorkforceController {
  constructor(private readonly workforce: WorkforceService) {}
  @Get()
  overview() { return this.workforce.overview(); }
}
