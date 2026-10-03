import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

@Controller('api/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateTaskDto) {
    return this.tasksService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateTaskDto) {
    return this.tasksService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.tasksService.start(id);
  }

  @Post(':id/block')
  block(@Param('id') id: string) {
    return this.tasksService.block(id);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string) {
    return this.tasksService.resume(id);
  }

  @Post(':id/submit-for-review')
  submitForReview(@Param('id') id: string) {
    return this.tasksService.submitForReview(id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.tasksService.complete(id);
  }
}
