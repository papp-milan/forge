import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PitchesService } from './pitches.service.js';
import { CreatePitchDto } from './dto/create-pitch.dto.js';
import { UpdatePitchDto } from './dto/update-pitch.dto.js';
import { PitchDecisionDto } from './dto/pitch-decision.dto.js';

@Controller('api/pitches')
export class PitchesController {
  constructor(private readonly pitchesService: PitchesService) {}

  @Get()
  findAll() {
    return this.pitchesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pitchesService.findOne(id);
  }

  @Post()
  create(@Body() data: CreatePitchDto) {
    return this.pitchesService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdatePitchDto) {
    return this.pitchesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pitchesService.remove(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() data: PitchDecisionDto) {
    return this.pitchesService.approve(id, data);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() data: PitchDecisionDto) {
    return this.pitchesService.reject(id, data);
  }

  @Post(':id/request-changes')
  requestChanges(@Param('id') id: string, @Body() data: PitchDecisionDto) {
    return this.pitchesService.requestChanges(id, data);
  }
}
