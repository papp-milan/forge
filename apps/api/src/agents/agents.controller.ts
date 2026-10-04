import { Body, Controller, Get, Param, Post, Query, Sse } from '@nestjs/common';
import { Observable, from, interval, map, startWith, switchMap, catchError, of } from 'rxjs';
import { ArtemisService } from './artemis.service.js';
import { HephaistosService } from './hephaistos.service.js';
import { AgentWorkerLoopService } from './agent-worker-loop.service.js';
import { ApolloService } from './apollo.service.js';
import { AgentRunService } from './agent-run.service.js';
import { AgentSessionService } from './agent-session.service.js';
import { AgentCommunicationService } from './agent-communication.service.js';
import { AgentActivityService } from './agent-activity.service.js';

@Controller('api/agents')
export class AgentsController {
  constructor(
    private readonly hephaistos: HephaistosService,
    private readonly artemis: ArtemisService,
    private readonly workerLoop: AgentWorkerLoopService,
    private readonly apollo: ApolloService,
    private readonly agentRuns: AgentRunService,
    private readonly sessions: AgentSessionService,
    private readonly communications: AgentCommunicationService,
    private readonly activity: AgentActivityService,
  ) {}

  @Get(':agent/activity')
  activityFeed(@Param('agent') agent: string, @Query('projectId') projectId?: string, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 100;
    return this.activity.list(agent, projectId, Number.isFinite(parsed) ? parsed : 100);
  }

  @Sse(':agent/activity/stream')
  activityStream(@Param('agent') agent: string, @Query('projectId') projectId?: string): Observable<MessageEvent> {
    return interval(2000).pipe(
      startWith(0),
      switchMap(() => from(this.activity.list(agent, projectId, 150))),
      map((data) => ({ data }) as MessageEvent),
      catchError(() => of({ data: [] } as MessageEvent)),
    );
  }

  @Get('worker/status')
  workerStatus() {
    return this.workerLoop.status();
  }

  @Get('sessions/:sessionId')
  session(@Param('sessionId') sessionId: string) {
    return this.sessions.get(sessionId);
  }

  @Post('sessions')
  startSession(@Body() body: { agent: string; runtime: string; projectId?: string; taskId?: string }) {
    return this.sessions.start(body);
  }

  @Post('sessions/:sessionId/messages')
  message(@Param('sessionId') sessionId: string, @Body() body: { role: string; content: unknown }) {
    return this.sessions.message(sessionId, body.role, body.content);
  }

  @Post('sessions/:sessionId/tool-calls')
  toolCall(@Param('sessionId') sessionId: string, @Body() body: { name: string; input?: unknown }) {
    return this.sessions.toolStart(sessionId, body.name, body.input);
  }

  @Post('sessions/tool-calls/:toolCallId/complete')
  completeToolCall(@Param('toolCallId') toolCallId: string, @Body() body: { status: string; output?: unknown; error?: string }) {
    return this.sessions.toolComplete(toolCallId, body.status, body.output, body.error);
  }

  @Post('sessions/:sessionId/artifacts')
  artifact(@Param('sessionId') sessionId: string, @Body() body: { name: string; type: string; uri?: string; checksum?: string; metadata?: unknown; projectId?: string; taskId?: string }) {
    return this.sessions.artifact({ sessionId, ...body });
  }

  @Post('sessions/:sessionId/usage')
  usage(@Param('sessionId') sessionId: string, @Body() body: { provider: string; model?: string; inputTokens?: number; outputTokens?: number; cachedTokens?: number; costUsd?: number }) {
    return this.sessions.usage(sessionId, body);
  }

  @Post('sessions/:sessionId/finish')
  finish(@Param('sessionId') sessionId: string, @Body() body: { status: 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'CANCELLED' }) {
    return this.sessions.finish(sessionId, body.status);
  }

  @Get('communications/inbox/:agent')
  communicationInbox(@Param('agent') agent: string) { return this.communications.inbox(agent); }

  @Get('communications/thread/:correlationId')
  communicationThread(@Param('correlationId') correlationId: string) { return this.communications.thread(correlationId); }

  @Post('communications')
  sendCommunication(@Body() body: Parameters<AgentCommunicationService['send']>[0]) { return this.communications.send(body); }

  @Post('communications/:id/acknowledge')
  acknowledgeCommunication(@Param('id') id: string) { return this.communications.acknowledge(id); }

  @Post('communications/:id/resolve')
  resolveCommunication(@Param('id') id: string) { return this.communications.resolve(id); }

  @Post('worker/run-once')
  runWorkerOnce() {
    return this.workerLoop.runOnce();
  }

  @Get('tasks/:taskId/artifacts')
  taskArtifacts(@Param('taskId') taskId: string) { return this.sessions.artifactsForTask(taskId); }

  @Get('tasks/:taskId/runs')
  taskRuns(@Param('taskId') taskId: string) {
    return this.agentRuns.recentForTask(taskId);
  }

  @Post('apollo/tasks/:taskId/run')
  runApollo(@Param('taskId') taskId: string) {
    return this.apollo.runTask(taskId);
  }

  @Post('hephaistos/tasks/:taskId/run')
  runHephaistos(@Param('taskId') taskId: string) {
    return this.hephaistos.runTask(taskId);
  }

  @Post('artemis/tasks/:taskId/review')
  reviewArtemis(@Param('taskId') taskId: string) {
    return this.artemis.reviewTask(taskId);
  }
}
