import { Injectable } from '@nestjs/common';
import { HermesRuntimeService, type HermesRunOptions, type HermesRunResult } from './hermes-runtime.service.js';

export type AgentRuntimeMode = 'hermes' | 'deterministic';

@Injectable()
export class AgentRuntimeService {
  constructor(private readonly hermes: HermesRuntimeService) {}

  mode(): AgentRuntimeMode {
    return (process.env['AGENT_RUNTIME'] ?? 'deterministic') === 'hermes' ? 'hermes' : 'deterministic';
  }

  async health() {
    if (this.mode() === 'deterministic') {
      return { mode: 'deterministic' as const, available: true, simulated: true };
    }
    const health = await this.hermes.health();
    return { mode: 'hermes' as const, ...health, simulated: false };
  }

  async run(options: HermesRunOptions): Promise<HermesRunResult> {
    if (this.mode() === 'hermes') return this.hermes.run(options);
    return {
      sessionId: 'det-' + Date.now(),
      text: 'Deterministic Forge runtime completed the worker simulation successfully.',
      exitCode: 0,
      durationMs: 25,
      tokens: { input: 0, output: 0, total: 0 },
    };
  }
}
