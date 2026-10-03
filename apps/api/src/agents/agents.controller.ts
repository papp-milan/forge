import { Controller, Param, Post } from '@nestjs/common';
import { HephaistosService } from './hephaistos.service.js';

@Controller('api/agents')
export class AgentsController {
  constructor(private readonly hephaistos: HephaistosService) {}

  @Post('hephaistos/tasks/:taskId/run')
  runHephaistos(@Param('taskId') taskId: string) {
    return this.hephaistos.runTask(taskId);
  }
}
