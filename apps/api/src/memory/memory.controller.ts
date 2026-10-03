import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  CreateMemoryDto,
  MemoryConfidenceDto,
  MemorySourceDto,
  MemoryTypeDto,
} from './dto/create-memory.dto.js';
import { MemoryService } from './memory.service.js';

@Controller('api/memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  findAll(@Query('scope') scope?: string) {
    return this.memoryService.list(scope);
  }

  @Get('*path')
  findOne(@Param('path') path: string[]) {
    return this.memoryService.get(path.join('/'));
  }

  @Post('*path')
  create(@Param('path') path: string[], @Body() dto: CreateMemoryDto) {
    return this.memoryService.create(
      path.join('/'),
      {
        id: dto.id,
        type: dto.type as MemoryTypeDto,
        confidence: dto.confidence as MemoryConfidenceDto,
        source: dto.source as MemorySourceDto,
        created: dto.created,
        updated: dto.created,
      },
      dto.content,
    );
  }

  @Put('*path')
  update(@Param('path') path: string[], @Body() dto: CreateMemoryDto) {
    return this.memoryService.update(
      path.join('/'),
      {
        id: dto.id,
        type: dto.type as MemoryTypeDto,
        confidence: dto.confidence as MemoryConfidenceDto,
        source: dto.source as MemorySourceDto,
        created: dto.created,
        updated: dto.created,
      },
      dto.content,
    );
  }

  @Delete('*path')
  remove(@Param('path') path: string[]) {
    return this.memoryService.delete(path.join('/'));
  }
}
