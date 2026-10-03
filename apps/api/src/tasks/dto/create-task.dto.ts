import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  acceptanceCriteria?: string;

  @IsString()
  @IsNotEmpty()
  featureId: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
