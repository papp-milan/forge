import { IsDateString, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum MemoryTypeDto {
  FACT = 'fact',
  DECISION = 'decision',
  LEARNING = 'learning',
}

export enum MemorySourceDto {
  CEO = 'ceo',
  TEAM = 'team',
  TEAM_LEAD = 'team_lead',
  UI_UX = 'ui_ux',
  ENGINEER = 'engineer',
  QA = 'qa',
  DEVOPS = 'devops',
  SYSTEM = 'system',
}

export enum MemoryConfidenceDto {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export class CreateMemoryDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsEnum(MemoryTypeDto)
  type: MemoryTypeDto;

  @IsEnum(MemoryConfidenceDto)
  confidence: MemoryConfidenceDto;

  @IsEnum(MemorySourceDto)
  source: MemorySourceDto;

  @IsDateString()
  created: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
