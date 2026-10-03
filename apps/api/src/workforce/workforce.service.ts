import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class WorkforceService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: { tasks: { where: { status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW'] } }, include: { feature: true } } },
      orderBy: { name: 'asc' },
    });

    const people = employees.map((employee) => {
      const active = employee.tasks.filter((task) => task.status !== 'BLOCKED').length;
      const blocked = employee.tasks.filter((task) => task.status === 'BLOCKED').length;
      const inReview = employee.tasks.filter((task) => task.status === 'IN_REVIEW').length;
      const utilization = Math.min(100, active * 25);
      return {
        employee: { id: employee.id, name: employee.name, role: employee.role, color: employee.color, status: employee.status },
        active, blocked, inReview, utilization,
        capacity: utilization >= 100 ? 'OVERLOADED' : utilization >= 75 ? 'BUSY' : 'AVAILABLE',
        tasks: employee.tasks.map((task) => ({ id: task.id, title: task.title, status: task.status, feature: task.feature.title })),
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      bottlenecks: people.filter((person) => person.blocked > 0 || person.utilization >= 100).map((person) => ({
        employeeId: person.employee.id, employee: person.employee.name,
        reason: person.blocked > 0 ? 'BLOCKED_TASKS' : 'OVERLOADED',
      })),
      people,
    };
  }
}
