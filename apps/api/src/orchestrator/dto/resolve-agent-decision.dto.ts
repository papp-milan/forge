import { IsOptional, IsString } from 'class-validator';

export class ResolveAgentDecisionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
