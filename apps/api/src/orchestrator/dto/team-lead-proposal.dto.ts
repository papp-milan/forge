import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmployeeRole } from '../../generated/prisma/enums.js';

export class TeamLeadTaskSuggestionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  acceptanceCriteria?: string;

  @IsEnum(EmployeeRole)
  role: EmployeeRole;
}

export class TeamLeadProposalDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  problem: string;

  @IsString()
  @IsNotEmpty()
  solution: string;

  @IsString()
  @IsNotEmpty()
  impact: string;

  @IsOptional()
  @IsString()
  risks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamLeadTaskSuggestionDto)
  tasks: TeamLeadTaskSuggestionDto[];
}
