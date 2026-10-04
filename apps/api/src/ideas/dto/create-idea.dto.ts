import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateIdeaDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(10000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsString()
  projectId!: string;
}
