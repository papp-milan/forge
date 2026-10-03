import { Controller, Get, Param, Post } from '@nestjs/common';
import { ArtemisService } from './artemis.service.js';
import { HephaistosService } from './hephaistos.service.js';
import { AgentWorkerLoopService } from './agent-worker-loop.service.js';

@Controller('api/agents')
export class AgentsController {
  constructor(
    private readonly hephaistos: HephaistosService,
    private readonly artemis: ArtemisService,
    private readonly workerLoop: AgentWorkerLoopService,
  ) {}

  @Get('worker/status')
  workerStatus() {
    return this.workerLoop.status();
  }

  @Post('hephaistos/tasks/:taskId/run')
  runHephaistos(@Param('taskId') taskId: string) {
    return this.hephaistos.runTask(taskId);
  }

  @Post('artemis/tasks/:taskId/review')
  reviewArtemis(@Param('taskId') taskId: string) {
    return this.artemis.reviewTask(taskId);
  }
}
