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
import { AssignTaskDto } from './dto/assign-task.dto.js';

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

  @Post(':id/approve-ceo')
  approveCeo(@Param('id') id: string, @Body() body: { comment?: string }) {
    return this.tasksService.approveCeo(id, body.comment);
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

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignTaskDto) {
    return this.tasksService.assign(id, dto.employeeId);
  }

  @Post(':id/github-issue')
  createGithubIssue(@Param('id') id: string) {
    return this.tasksService.createGithubIssue(id);
  }

  @Post(':id/github-branch')
  createGithubBranch(@Param('id') id: string) {
    return this.tasksService.createGithubBranch(id);
  }

  @Post(':id/github-pull-request')
  createGithubPullRequest(@Param('id') id: string) {
    return this.tasksService.createGithubPullRequest(id);
  }
}
