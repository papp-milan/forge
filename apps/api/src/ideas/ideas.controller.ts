import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IdeasService } from './ideas.service.js';
import { CreateIdeaDto } from './dto/create-idea.dto.js';
import { UpdateIdeaDto } from './dto/update-idea.dto.js';

@Controller('api/ideas')
export class IdeasController {
  constructor(private readonly ideas: IdeasService) {}

  @Get()
  findAll(@Query('projectId') projectId?: string) { return this.ideas.findAll(projectId); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.ideas.findOne(id); }

  @Post()
  create(@Body() body: CreateIdeaDto) { return this.ideas.create(body); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateIdeaDto) { return this.ideas.update(id, body); }

  @Post(':id/pitch')
  pitch(@Param('id') id: string) { return this.ideas.pitch(id); }

  @Post(':id/archive')
  archive(@Param('id') id: string) { return this.ideas.archive(id); }
}
