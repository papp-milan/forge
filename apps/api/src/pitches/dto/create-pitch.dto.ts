import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePitchDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  rationale?: string;

  @IsString()
  @IsNotEmpty()
  projectId: string;
}
