import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { FeaturesModule } from './features/features.module.js';
import { PitchesModule } from './pitches/pitches.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { GithubModule } from './github/github.module.js';

@Module({
  imports: [
    PrismaModule,
    ProjectsModule,
    EmployeesModule,
    FeaturesModule,
    PitchesModule,
    TasksModule,
    GithubModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
