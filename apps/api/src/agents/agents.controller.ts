import { Controller, Param, Post } from '@nestjs/common';
import { ArtemisService } from './artemis.service.js';
import { HephaistosService } from './hephaistos.service.js';

@Controller('api/agents')
export class AgentsController {
  constructor(
    private readonly hephaistos: HephaistosService,
    private readonly artemis: ArtemisService,
  ) {}

  @Post('hephaistos/tasks/:taskId/run')
  runHephaistos(@Param('taskId') taskId: string) {
    return this.hephaistos.runTask(taskId);
  }

  @Post('artemis/tasks/:taskId/review')
  reviewArtemis(@Param('taskId') taskId: string) {
    return this.artemis.reviewTask(taskId);
  }
}
