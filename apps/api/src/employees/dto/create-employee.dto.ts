import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { EmployeeRole } from '../../generated/prisma/enums.js';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(EmployeeRole)
  role: EmployeeRole;

  @IsOptional()
  @IsString()
  description?: string;
}
