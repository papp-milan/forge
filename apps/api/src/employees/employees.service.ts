import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
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
