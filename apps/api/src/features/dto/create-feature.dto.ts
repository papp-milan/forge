import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  projectId: string;
}
