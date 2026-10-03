import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { EmployeeRole, EmployeeStatus } from '../../generated/prisma/enums.js';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(EmployeeRole)
  role?: EmployeeRole;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  description?: string;
}
