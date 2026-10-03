import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateFeatureDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;
}
