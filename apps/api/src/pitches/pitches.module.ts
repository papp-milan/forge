import { Module } from '@nestjs/common';
import { PitchesController } from './pitches.controller.js';
import { PitchesService } from './pitches.service.js';

@Module({
  controllers: [PitchesController],
  providers: [PitchesService],
})
export class PitchesModule {}
