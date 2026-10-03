import { IsOptional, IsString } from 'class-validator';

export class PitchDecisionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
