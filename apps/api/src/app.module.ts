import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { FeaturesModule } from './features/features.module.js';

@Module({
  imports: [PrismaModule, ProjectsModule, EmployeesModule, FeaturesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
