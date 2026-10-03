import { AgentSessionService } from './agent-session.service.js';

describe('AgentSessionService', () => {
  it('appends messages with monotonic sequence numbers', async () => {
    const prisma = {
      agentSession: { findUnique: async () => ({ id: 's1', status: 'RUNNING' }) },
      agentMessage: {
        findFirst: async () => ({ sequence: 4 }),
        create: async ({ data }: any) => data,
      },
    };
    const service = new AgentSessionService(prisma as any);
    const result = await service.message('s1', 'assistant', { text: 'hello' });
    expect(result.sequence).toBe(5);
    expect(result.role).toBe('assistant');
  });

  it('rejects finishing an already terminal session', async () => {
    const prisma = { agentSession: { findUnique: async () => ({ status: 'COMPLETED' }) } };
    const service = new AgentSessionService(prisma as any);
    await expect(service.finish('s1', 'FAILED')).rejects.toThrow('Only running sessions');
  });
});
