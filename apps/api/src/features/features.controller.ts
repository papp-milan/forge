import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { FeaturesService } from './features.service.js';
import { CreateFeatureDto } from './dto/create-feature.dto.js';
import { UpdateFeatureDto } from './dto/update-feature.dto.js';

@Controller('api/features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get()
  findAll() {
    return this.featuresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.featuresService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateFeatureDto) {
    return this.featuresService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateFeatureDto) {
    return this.featuresService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.featuresService.remove(id);
  }

  @Post(':id/plan')
  plan(@Param('id') id: string) {
    return this.featuresService.plan(id);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.featuresService.start(id);
  }

  @Post(':id/submit-for-qa')
  submitForQa(@Param('id') id: string) {
    return this.featuresService.submitForQa(id);
  }

  @Post(':id/approve-qa')
  approveQa(@Param('id') id: string) {
    return this.featuresService.approveQa(id);
  }

  @Post(':id/release')
  release(@Param('id') id: string) {
    return this.featuresService.release(id);
  }
}
