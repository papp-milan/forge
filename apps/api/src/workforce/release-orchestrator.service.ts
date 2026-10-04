import { Injectable } from '@nestjs/common';
import { NikeService } from './nike.service.js';

@Injectable()
export class ReleaseOrchestratorService {
  constructor(private readonly nike: NikeService) {}

  async release(featureId: string) {
    return this.nike.releaseApprovedFeature(featureId);
  }

  async releaseAutonomous() {
    return this.nike.releaseAutonomousReady();
  }
}
