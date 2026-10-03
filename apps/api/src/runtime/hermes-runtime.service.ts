import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';

export interface HermesRunOptions {
  prompt: string;
  cwd?: string;
  model?: string;
  maxTurns?: number;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface HermesRunResult {
  sessionId?: string;
  text: string;
  exitCode: number;
  durationMs: number;
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
}

@Injectable()
export class HermesRuntimeService {
  private readonly command = process.env['HERMES_COMMAND'] ?? 'hermes';
  private readonly defaultCwd = process.env['HERMES_WORKDIR'];
  private readonly defaultTimeoutMs = Number(
    process.env['HERMES_TIMEOUT_MS'] ?? 300_000,
  );

  async health(): Promise<{ available: boolean; command: string }> {
    try {
      const result = await this.runProcess(['--version'], '', {
        cwd: this.defaultCwd,
        timeoutMs: 15_000,
      });

      return {
        available: result.exitCode === 0,
        command: this.command,
      };
    } catch {
      return {
        available: false,
        command: this.command,
      };
    }
  }

  async run(options: HermesRunOptions): Promise<HermesRunResult> {
    if (!options.prompt.trim()) {
      throw new ServiceUnavailableException('Hermes prompt cannot be empty');
    }

    const args = [
      'chat',
      '--oneshot',
      '--query-file',
      '-',
      '--format',
      'stream-json',
      '--source',
      'tool',
    ];

    if (options.model) {
      args.push('--model', options.model);
    }

    if (options.maxTurns) {
      args.push('--max-turns', String(options.maxTurns));
    }

    const result = await this.runProcess(args, options.prompt, {
      cwd: options.cwd ?? this.defaultCwd,
      timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
      env: options.env,
    });

    return this.parseStream(result.stdout, result.exitCode, result.durationMs);
  }

  private runProcess(
    args: string[],
    input: string,
    options: { cwd?: string; timeoutMs: number; env?: NodeJS.ProcessEnv },
  ): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const child = spawn(this.command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (value: { stdout: string; stderr: string; exitCode: number; durationMs: number }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };

      const timer = setTimeout(() => {
        if (settled) return;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 2_000).unref();
        reject(new Error(`Hermes timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on('close', (code) => {
        finish({
          stdout,
          stderr,
          exitCode: code ?? 1,
          durationMs: Date.now() - started,
        });
      });

      child.stdin.write(input);
      child.stdin.end();
    });
  }

  private parseStream(
    stdout: string,
    exitCode: number,
    durationMs: number,
  ): HermesRunResult {
    let sessionId: string | undefined;
    let text = '';
    let tokens: HermesRunResult['tokens'];

    for (const line of stdout.split('\n').filter(Boolean)) {
      try {
        const event = JSON.parse(line) as Record<string, unknown>;

        if (event['type'] === 'system' && event['subtype'] === 'init') {
          sessionId = typeof event['session_id'] === 'string'
            ? event['session_id']
            : undefined;
        }

        if (event['type'] === 'text' && typeof event['text'] === 'string') {
          text += event['text'];
        }

        if (event['type'] === 'result') {
          if (typeof event['session_id'] === 'string') {
            sessionId = event['session_id'];
          }

          if (typeof event['text'] === 'string') {
            text = event['text'];
          }

          const usage = event['tokens'];
          if (usage && typeof usage === 'object') {
            const value = usage as Record<string, unknown>;
            tokens = {
              input: typeof value['input'] === 'number' ? value['input'] : undefined,
              output: typeof value['output'] === 'number' ? value['output'] : undefined,
              total: typeof value['total'] === 'number' ? value['total'] : undefined,
            };
          }
        }
      } catch {
        // Ignore non-JSON diagnostics on stdout.
      }
    }

    return {
      sessionId,
      text: text.trim(),
      exitCode,
      durationMs,
      tokens,
    };
  }
}
