import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { AuditService } from '../audit/audit.service.js';

export type MemoryType = 'fact' | 'decision' | 'learning';

export type MemorySource =
  | 'ceo'
  | 'team'
  | 'team_lead'
  | 'ui_ux'
  | 'engineer'
  | 'qa'
  | 'devops'
  | 'system';

export type MemoryConfidence = 'low' | 'medium' | 'high';

export interface MemoryMetadata {
  id: string;
  type: MemoryType;
  confidence: MemoryConfidence;
  source: MemorySource;
  created: string;
  updated: string;
}

export interface Memory {
  metadata: MemoryMetadata;
  content: string;
  path: string;
}

@Injectable()
export class MemoryService {
  constructor(private readonly audit: AuditService) {}

  private readonly memoryRoot = path.resolve(process.cwd(), '../../memory');

  async list(scope?: string): Promise<Memory[]> {
    const directory = scope ? this.resolveScope(scope) : this.memoryRoot;

    const files = await this.findMarkdownFiles(directory);

    return Promise.all(files.map((filePath) => this.readFile(filePath)));
  }

  async get(relativePath: string): Promise<Memory> {
    const filePath = this.resolveSafePath(relativePath);

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('Memory not found');
    }

    return this.readFile(filePath);
  }

  async create(
    relativePath: string,
    metadata: MemoryMetadata,
    content: string,
  ): Promise<Memory> {
    this.validateContent(content);

    const filePath = this.resolveSafePath(relativePath);

    try {
      await fs.access(filePath);

      throw new BadRequestException('Memory already exists');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
    }

    await fs.mkdir(path.dirname(filePath), {
      recursive: true,
    });

    const document = this.serialize(metadata, content);

    await fs.writeFile(filePath, document, 'utf8');

    const result = await this.readFile(filePath);
    await this.audit.record({
      actor: metadata.source === 'ceo' ? 'ceo' : 'system',
      type: 'MEMORY_CREATED',
      entityType: 'memory',
      entityId: metadata.id,
      summary: `Created memory ${relativePath}`,
      data: { path: relativePath, source: metadata.source, type: metadata.type },
    });

    return result;
  }

  async update(
    relativePath: string,
    metadata: MemoryMetadata,
    content: string,
  ): Promise<Memory> {
    this.validateContent(content);

    const filePath = this.resolveSafePath(relativePath);

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('Memory not found');
    }

    const updatedMetadata: MemoryMetadata = {
      ...metadata,
      updated: this.today(),
    };

    const document = this.serialize(updatedMetadata, content);

    await fs.writeFile(filePath, document, 'utf8');

    const result = await this.readFile(filePath);
    await this.audit.record({
      actor: metadata.source === 'ceo' ? 'ceo' : 'system',
      type: 'MEMORY_UPDATED',
      entityType: 'memory',
      entityId: metadata.id,
      summary: `Updated memory ${relativePath}`,
      data: { path: relativePath, source: metadata.source, type: metadata.type },
    });

    return result;
  }

  async delete(relativePath: string): Promise<void> {
    const filePath = this.resolveSafePath(relativePath);

    try {
      await fs.unlink(filePath);
    } catch {
      throw new NotFoundException('Memory not found');
    }

    await this.audit.record({
      actor: 'system',
      type: 'MEMORY_DELETED',
      entityType: 'memory',
      summary: `Deleted memory ${relativePath}`,
      data: { path: relativePath },
    });
  }

  private async readFile(filePath: string): Promise<Memory> {
    const raw = await fs.readFile(filePath, 'utf8');

    const metadata = this.parseMetadata(raw);
    const content = this.extractContent(raw);

    return {
      metadata,
      content,
      path: path.relative(this.memoryRoot, filePath),
    };
  }

  private serialize(metadata: MemoryMetadata, content: string): string {
    return `---
id: ${metadata.id}
type: ${metadata.type}
confidence: ${metadata.confidence}
source: ${metadata.source}
created: ${metadata.created}
updated: ${metadata.updated}
---

${content.trim()}
`;
  }

  private parseMetadata(content: string): MemoryMetadata {
    const match = content.match(/^---\n([\s\S]*?)\n---/);

    if (!match) {
      throw new BadRequestException('Invalid memory file: missing frontmatter');
    }

    const values: Record<string, string> = {};

    for (const line of match[1].split('\n')) {
      const separator = line.indexOf(':');

      if (separator === -1) {
        continue;
      }

      const key = line.slice(0, separator).trim();

      const value = line.slice(separator + 1).trim();

      values[key] = value;
    }

    return {
      id: values.id,
      type: values.type as MemoryType,
      confidence: values.confidence as MemoryConfidence,
      source: values.source as MemorySource,
      created: values.created,
      updated: values.updated,
    };
  }

  private extractContent(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
  }

  private resolveSafePath(relativePath: string): string {
    if (!relativePath.endsWith('.md')) {
      throw new BadRequestException('Memory files must use .md extension');
    }

    const resolved = path.resolve(this.memoryRoot, relativePath);

    if (
      resolved !== this.memoryRoot &&
      !resolved.startsWith(`${this.memoryRoot}${path.sep}`)
    ) {
      throw new BadRequestException('Invalid memory path');
    }

    return resolved;
  }

  private resolveScope(scope: string): string {
    const resolved = path.resolve(this.memoryRoot, scope);

    if (
      resolved !== this.memoryRoot &&
      !resolved.startsWith(`${this.memoryRoot}${path.sep}`)
    ) {
      throw new BadRequestException('Invalid memory scope');
    }

    return resolved;
  }

  private async findMarkdownFiles(directory: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          files.push(...(await this.findMarkdownFiles(fullPath)));
        }

        if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }

      return files;
    } catch {
      return [];
    }
  }

  private validateContent(content: string): void {
    if (!content.trim()) {
      throw new BadRequestException('Memory content cannot be empty');
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
