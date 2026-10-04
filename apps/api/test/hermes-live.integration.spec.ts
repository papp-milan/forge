import { describe, expect, it } from 'vitest';
import { HermesRuntimeService } from '../src/runtime/hermes-runtime.service.js';

describe('Hermes live runtime integration', () => {
  const enabled = process.env['FORGE_HERMES_LIVE_TEST'] === 'true';

  it.runIf(enabled)(
    'executes a read-only repository analysis through the configured Hermes provider',
    async () => {
      const runtime = new HermesRuntimeService();
      const cwd = process.env['HERMES_WORKDIR'] ?? process.cwd();

      const result = await runtime.run({
        cwd,
        timeoutMs: Number(process.env['HERMES_LIVE_TEST_TIMEOUT_MS'] ?? 180_000),
        maxTurns: 20,
        prompt: [
          "You are a read-only integration-test agent for Forge.",
          "Do not modify, create, delete, commit, push, or otherwise change any files.",
          "Inspect the current repository.",
          "Return exactly three concise facts:",
          "1. The repository/project name.",
          "2. The primary application technologies.",
          "3. Whether you can access the filesystem.",
          "Do not run destructive commands.",
        ].join('\n'),
      });

      expect(result.exitCode).toBe(0);
      expect(result.sessionId).toBeTruthy();
      expect(result.text).toContain('Forge');
      expect(result.text.length).toBeGreaterThan(40);
    },
    180_000,
  );

  it.runIf(!enabled)(
    'is opt-in so CI and normal test runs never invoke the real agent',
    () => {
      expect(enabled).toBe(false);
    },
  );
});
