import { Injectable } from '@nestjs/common';
import { FeaturesService } from '../features/features.service.js';

@Injectable()
export class ReleaseOrchestratorService {
  constructor(private readonly features: FeaturesService) {}
  async release(featureId: string) {
    return this.features.release(featureId);
  }
}
