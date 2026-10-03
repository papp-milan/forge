import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Controller('api/github')
export class GithubWebhookController {
  @Post('webhook')
  @HttpCode(200)
  handleWebhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-github-delivery') delivery: string | undefined,
  ) {
    const secret = process.env['GITHUB_WEBHOOK_SECRET'];

    if (!secret) {
      throw new Error('GITHUB_WEBHOOK_SECRET is not configured');
    }

    if (!signature) {
      throw new UnauthorizedException('Missing GitHub webhook signature');
    }

    if (!request.rawBody) {
      throw new Error('Raw request body is not available');
    }

    const expectedSignature = `sha256=${createHmac('sha256', secret)
      .update(request.rawBody)
      .digest('hex')}`;

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid GitHub webhook signature');
    }

    console.log(`[GitHub Webhook] ${event} (${delivery})`);

    return {
      received: true,
      event,
      delivery,
    };
  }
}
