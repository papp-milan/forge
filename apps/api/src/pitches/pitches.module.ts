import { Module } from '@nestjs/common';
import { PitchesController } from './pitches.controller.js';
import { PitchesService } from './pitches.service.js';
import { OrchestratorModule } from '../orchestrator/orchestrator.module.js';

@Module({
  imports: [OrchestratorModule],
  controllers: [PitchesController],
  providers: [PitchesService],
})
export class PitchesModule {}
