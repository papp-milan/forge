import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AgentRuntimeService } from '../runtime/agent-runtime.service.js';
import { WorkspaceService } from './workspace.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AgentCommunicationService } from './agent-communication.service.js';

export interface QaResult { passed: boolean; summary: string; findings: string[]; }

@Injectable()
export class ArtemisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: AgentRuntimeService,
    private readonly workspaces: WorkspaceService,
    private readonly audit: AuditService,
    private readonly communications: AgentCommunicationService,
  ) {}

  async reviewTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { feature: { include: { project: true } } },
    });
    if (!task) throw new BadRequestException('Task not found');
    if (task.status !== 'IN_REVIEW') throw new BadRequestException('Artemis can only review tasks in IN_REVIEW');
    if (!task.feature.project.repository) throw new BadRequestException('Project has no GitHub repository configured');
    if (!task.branchName) throw new BadRequestException('Task has no GitHub branch');

    const workspace = await this.workspaces.prepare(task.feature.project.repository, task.branchName);
    await this.audit.record({ actor: 'artemis', type: 'QA_STARTED', projectId: task.feature.projectId, entityType: 'task', entityId: task.id, summary: task.title, data: { repository: workspace.repository, branch: workspace.branch } });

    try {
      const result = await this.runtime.run({ cwd: workspace.cwd, env: workspace.env, maxTurns: 40, prompt: this.buildPrompt(task) });
      const qa = this.parseResult(result.text);
      await this.audit.record({ actor: 'artemis', type: qa.passed ? 'QA_PASSED' : 'QA_FAILED', projectId: task.feature.projectId, entityType: 'task', entityId: task.id, summary: qa.summary || task.title, data: { branch: workspace.branch, sessionId: result.sessionId, exitCode: result.exitCode, findings: qa.findings } });

      if (qa.passed && result.exitCode === 0) {
        const updated = await this.prisma.task.update({ where: { id: task.id }, data: { status: 'DONE' }, include: { assignee: true, feature: true } });
        return { status: 'PASSED', task: updated, qa, result };
      }

      await this.communications.send({
        fromAgent: 'artemis', toAgent: 'athena', kind: 'DISPUTE', priority: 'HIGH',
        subject: 'QA rejection: ' + task.title,
        content: { taskId: task.id, summary: qa.summary, findings: qa.findings, recommendation: 'Return the task to the implementation agent for remediation.' },
        projectId: task.feature.projectId, featureId: task.feature.id, taskId: task.id,
      });
      const blocked = await this.prisma.task.update({ where: { id: task.id }, data: { status: 'BLOCKED' }, include: { assignee: true, feature: true } });
      return { status: 'FAILED', task: blocked, qa, result };
    } finally {
      await workspace.cleanup();
    }
  }

  private buildPrompt(task: any): string {
    return [
      'You are Artemis, Forge\'s skeptical and adversarial QA gate.',
      'Actively try to break the implementation with edge cases and regressions.',
      'If evidence is insufficient, fail the review and explain the findings precisely.',
      'Review the current branch as read-only. Do not modify files, commit, push, merge, or release anything.',
      'Inspect the implementation against the acceptance criteria.',
      'Run the most relevant automated tests and build checks.',
      'Look for regressions and obvious edge cases.',
      'Return exactly one JSON object with: passed, summary, findings.',
      'passed must be true only when the acceptance criteria and relevant checks are satisfied.',
      'findings must be an array of concise strings.',
      '',
      'Task: ' + task.title,
      'Description: ' + (task.description ?? 'No additional description.'),
      'Acceptance criteria: ' + (task.acceptanceCriteria ?? 'Use the task description as the acceptance criteria.'),
      'Feature: ' + task.feature.title,
    ].join('\n');
  }

  private parseResult(text: string): QaResult {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] ?? text;
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first === -1 || last <= first) throw new BadRequestException('Artemis returned invalid QA JSON');
    try {
      const parsed = JSON.parse(candidate.slice(first, last + 1)) as Partial<QaResult>;
      if (typeof parsed.passed !== 'boolean') throw new Error('passed must be boolean');
      return { passed: parsed.passed, summary: typeof parsed.summary === 'string' ? parsed.summary : '', findings: Array.isArray(parsed.findings) ? parsed.findings.map(String) : [] };
    } catch {
      throw new BadRequestException('Artemis returned invalid QA JSON');
    }
  }
}