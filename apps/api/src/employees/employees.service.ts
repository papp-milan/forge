import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';

const DEFAULT_EMPLOYEES = [
  { name: 'Athena', role: 'TEAM_LEAD' as const, color: '#8b5cf6', description: 'Team Lead and product strategy.' },
  { name: 'Apollo', role: 'UI_UX' as const, color: '#f59e0b', description: 'UI/UX and frontend experience.' },
  { name: 'Hephaistos', role: 'ENGINEER' as const, color: '#ef4444', description: 'Software engineering and implementation.' },
  { name: 'Artemis', role: 'QA' as const, color: '#22c55e', description: 'Quality assurance and verification.' },
  { name: 'Nike', role: 'DEVOPS' as const, color: '#06b6d4', description: 'Release management and delivery.' },
  { name: 'Atlas', role: 'DEVOPS' as const, color: '#3b82f6', description: 'Infrastructure and deployment.' },
] as const;

@Injectable()
export class EmployeesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureDefaults() {
    for (const employee of DEFAULT_EMPLOYEES) {
      const existing = await this.prisma.employee.findFirst({ where: { name: employee.name } });

      if (existing) {
        if (
          existing.role !== employee.role ||
          existing.color !== employee.color ||
          existing.description !== employee.description ||
          existing.status !== 'ACTIVE'
        ) {
          await this.prisma.employee.update({
            where: { id: existing.id },
            data: {
              role: employee.role,
              color: employee.color,
              description: employee.description,
              status: 'ACTIVE',
            },
          });
        }
      } else {
        await this.prisma.employee.create({ data: employee });
      }
    }
  }

  async onModuleInit() {
    await this.ensureDefaults();
  }

  async findAll() {
    // Self-heal the built-in crew if a local database was reset or migrated
    // without rerunning application startup initialization.
    await this.ensureDefaults();

    return this.prisma.employee.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.employee.findUnique({
      where: {
        id,
      },
    });
  }

  create(data: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data,
    });
  }

  update(id: string, data: UpdateEmployeeDto) {
    return this.prisma.employee.update({
      where: {
        id,
      },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.employee.delete({
      where: {
        id,
      },
    });
  }
}
