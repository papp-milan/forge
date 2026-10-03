import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger(GithubWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(deliveryId: string, event: string, payload: any) {
    const action = typeof payload?.action === 'string' ? payload.action : null;

    const repository =
      typeof payload?.repository?.full_name === 'string'
        ? payload.repository.full_name
        : null;

    const existing = await this.prisma.githubWebhookEvent.findUnique({
      where: {
        deliveryId,
      },
    });

    if (existing) {
      this.logger.log(`Ignoring duplicate GitHub delivery ${deliveryId}`);

      return existing;
    }

    const webhookEvent = await this.prisma.githubWebhookEvent.create({
      data: {
        deliveryId,
        event,
        action,
        repository,
        payload,
      },
    });

    try {
      await this.processEvent(event, action, payload);

      return this.prisma.githubWebhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          processedAt: new Date(),
          error: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown webhook processing error';

      this.logger.error(
        `Failed to process GitHub event ${deliveryId}: ${message}`,
      );

      return this.prisma.githubWebhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          error: message,
        },
      });
    }
  }

  private async processEvent(
    event: string,
    action: string | null,
    payload: any,
  ) {
    switch (event) {
      case 'push':
        await this.handlePush(payload);
        break;

      case 'pull_request':
        await this.handlePullRequest(action, payload);
        break;

      case 'workflow_run':
        await this.handleWorkflowRun(action, payload);
        break;

      default:
        this.logger.log(`Received unhandled GitHub event: ${event}`);
    }
  }

  private async handlePush(payload: any) {
    const branch = this.extractBranch(payload?.ref);

    if (!branch) {
      return;
    }

    this.logger.log(
      `GitHub push: ${payload?.repository?.full_name} → ${branch}`,
    );
  }

  private async handlePullRequest(action: string | null, payload: any) {
    const pullRequest = payload?.pull_request;

    if (!pullRequest) {
      return;
    }

    const branch = pullRequest?.head?.ref;

    if (!branch) {
      return;
    }

    const task = await this.prisma.task.findFirst({
      where: {
        branchName: branch,
      },
    });

    if (!task) {
      this.logger.log(`No Forge task found for PR branch ${branch}`);

      return;
    }

    await this.prisma.task.update({
      where: {
        id: task.id,
      },
      data: {
        pullRequestNumber: pullRequest.number,
        pullRequestUrl: pullRequest.html_url,
      },
    });

    if (action === 'closed' && pullRequest.merged === true) {
      await this.prisma.task.update({
        where: {
          id: task.id,
        },
        data: {
          status: 'DONE',
        },
      });

      this.logger.log(
        `Task ${task.id} completed because PR #${pullRequest.number} was merged`,
      );
    }

    this.logger.log(`Processed PR event: ${action} for task ${task.id}`);
  }

  private async handleWorkflowRun(action: string | null, payload: any) {
    const workflowRun = payload?.workflow_run;

    if (!workflowRun) {
      return;
    }

    this.logger.log(
      `GitHub Actions workflow "${workflowRun.name}" → ${action}: ${workflowRun.conclusion ?? workflowRun.status}`,
    );
  }

  private extractBranch(ref: unknown): string | null {
    if (typeof ref !== 'string' || !ref.startsWith('refs/heads/')) {
      return null;
    }

    return ref.replace('refs/heads/', '');
  }
}
