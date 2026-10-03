import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePitchDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsString()
  rationale?: string;
}
