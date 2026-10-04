import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class UpdateFeatureDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsIn(['CEO_APPROVAL', 'AUTONOMOUS'])
  releasePolicy?: 'CEO_APPROVAL' | 'AUTONOMOUS';
}
