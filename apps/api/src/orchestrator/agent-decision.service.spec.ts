import { AgentDecisionService } from './agent-decision.service.js';

const decision = {
  id: 'd1',
  agent: 'ATHENA',
  type: 'RELEASE_FEATURE',
  priority: 'HIGH',
  title: 'Release feature',
  reasoning: 'ready',
  evidence: [],
  actions: [{ type: 'RELEASE_FEATURE', featureId: 'f1' }],
  requiresCeoApproval: true,
  status: 'APPROVED',
  approvedAt: new Date(),
  projectId: 'p1',
  project: { id: 'p1' },
};

describe('AgentDecisionService', () => {
  it('refuses a gated decision without recorded CEO approval', async () => {
    const prisma = {
      agentDecision: {
        findUnique: async () => ({ ...decision, approvedAt: null }),
      },
    };
    const service = new AgentDecisionService(prisma as any, {} as any, {} as any);

    await expect(service.execute('d1')).rejects.toThrow('CEO approval is required');
  });

  it('atomically claims execution so only one concurrent caller executes', async () => {
    let status = 'APPROVED';
    let claims = 0;
    let executions = 0;
    const prisma = {
      agentDecision: {
        findUnique: async () => ({ ...decision, status, approvedAt: new Date() }),
        updateMany: async () => {
          claims += 1;
          if (claims === 1) {
            status = 'EXECUTING';
            return { count: 1 };
          }
          return { count: 0 };
        },
        update: async ({ data }: any) => ({ ...decision, status: data.status, approvedAt: new Date() }),
      },
    };
    const executor = { execute: async () => { executions += 1; status = 'EXECUTED'; return [{ status: 'EXECUTED', actionType: 'RELEASE_FEATURE' }]; } };
    const audit = { record: async () => undefined };
    const service = new AgentDecisionService(prisma as any, executor as any, audit as any);

    const results = await Promise.allSettled([service.execute('d1'), service.execute('d1')]);

    expect(executions).toBe(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
  it('recovers decisions stuck in EXECUTING beyond the stale timeout', async () => {
    const updates: string[] = [];
    const prisma = {
      agentDecision: {
        findMany: async () => [{ id: 'd-stale', projectId: 'p1', title: 'Stale decision' }],
        updateMany: async ({ data }: any) => { updates.push(data.status); return { count: 1 }; },
      },
    };
    const audit = { record: async () => undefined };
    const service = new AgentDecisionService(prisma as any, {} as any, audit as any);
    const stale = await service.recoverStaleExecuting(60_000);
    expect(stale).toHaveLength(1);
    expect(updates).toEqual(['FAILED']);
  });

});
