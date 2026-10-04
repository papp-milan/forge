import { Controller, Get, Param, Post } from '@nestjs/common';
import { WorkforceService } from './workforce.service.js';
import { NikeService } from './nike.service.js';

@Controller('api/workforce')
export class WorkforceController {
  constructor(private readonly workforce: WorkforceService, private readonly nike: NikeService) {}
  @Get()
  overview() { return this.workforce.overview(); }

  @Get('nike/prepare/:featureId')
  nikePrepare(@Param('featureId') featureId: string) { return this.nike.prepareRelease(featureId); }

  @Post('nike/release/:featureId')
  nikeRelease(@Param('featureId') featureId: string) { return this.nike.releaseApprovedFeature(featureId); }

  @Post('nike/release-autonomous')
  nikeReleaseAutonomous() { return this.nike.releaseAutonomousReady(); }
}
