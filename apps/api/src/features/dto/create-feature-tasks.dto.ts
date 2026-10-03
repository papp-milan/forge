import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFeatureTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  acceptanceCriteria?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}

export class CreateFeatureTasksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFeatureTaskDto)
  tasks: CreateFeatureTaskDto[];
}
