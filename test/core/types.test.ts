import { describe, it, expect } from 'vitest';
import {
  ArtifactDefinitionSchema,
  WorkflowSchemaSchema,
  ProjectConfigSchema,
  ChangeMetadataSchema,
  GlobalConfigSchema,
  safeParse,
  formatZodErrors,
} from '../../src/core/artifact-graph/types.js';

// ─── ArtifactDefinitionSchema ─────────────────────────────────────────────

describe('ArtifactDefinitionSchema', () => {
  it('should parse a valid artifact definition', () => {
    const result = ArtifactDefinitionSchema.safeParse({
      id: 'proposal',
      generates: 'proposal.md',
      description: 'Propuesta del cambio',
      template: 'proposal.md',
      requires: [],
    });
    expect(result.success).toBe(true);
  });

  it('should default requires to empty array', () => {
    const result = ArtifactDefinitionSchema.parse({
      id: 'proposal',
      generates: 'proposal.md',
      description: 'A proposal',
    });
    expect(result.requires).toEqual([]);
  });

  it('should reject invalid id (uppercase)', () => {
    const result = ArtifactDefinitionSchema.safeParse({
      id: 'Proposal',
      generates: 'proposal.md',
      description: 'Bad id',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid id (starts with number)', () => {
    const result = ArtifactDefinitionSchema.safeParse({
      id: '1proposal',
      generates: 'proposal.md',
      description: 'Bad id',
    });
    expect(result.success).toBe(false);
  });

  it('should accept hyphenated ids', () => {
    const result = ArtifactDefinitionSchema.safeParse({
      id: 'api-design',
      generates: 'design.md',
      description: 'API design doc',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty generates', () => {
    const result = ArtifactDefinitionSchema.safeParse({
      id: 'proposal',
      generates: '',
      description: 'A proposal',
    });
    expect(result.success).toBe(false);
  });

  it('should accept glob patterns in generates', () => {
    const result = ArtifactDefinitionSchema.safeParse({
      id: 'specs',
      generates: 'specs/**/*.md',
      description: 'Specs',
    });
    expect(result.success).toBe(true);
  });
});

// ─── WorkflowSchemaSchema ─────────────────────────────────────────────────

describe('WorkflowSchemaSchema', () => {
  const validSchema = {
    name: 'spec-driven',
    version: 1,
    description: 'Spec-driven development workflow',
    artifacts: [
      {
        id: 'proposal',
        generates: 'proposal.md',
        description: 'Change proposal',
        requires: [],
      },
      {
        id: 'specs',
        generates: 'specs/**/*.md',
        description: 'Behavior specs',
        requires: ['proposal'],
      },
      {
        id: 'design',
        generates: 'design.md',
        description: 'Technical design',
        requires: ['proposal'],
      },
      {
        id: 'tasks',
        generates: 'tasks.md',
        description: 'Implementation tasks',
        requires: ['specs', 'design'],
      },
    ],
  };

  it('should parse a valid workflow schema', () => {
    const result = WorkflowSchemaSchema.safeParse(validSchema);
    expect(result.success).toBe(true);
  });

  it('should reject duplicate artifact IDs', () => {
    const result = WorkflowSchemaSchema.safeParse({
      ...validSchema,
      artifacts: [
        {
          id: 'proposal',
          generates: 'a.md',
          description: 'A',
          requires: [],
        },
        {
          id: 'proposal',
          generates: 'b.md',
          description: 'B',
          requires: [],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('unique'))).toBe(
        true,
      );
    }
  });

  it('should reject dependencies referencing non-existent IDs', () => {
    const result = WorkflowSchemaSchema.safeParse({
      ...validSchema,
      artifacts: [
        {
          id: 'proposal',
          generates: 'proposal.md',
          description: 'Proposal',
          requires: ['nonexistent'],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('existing artifact')),
      ).toBe(true);
    }
  });

  it('should reject empty artifacts array', () => {
    const result = WorkflowSchemaSchema.safeParse({
      ...validSchema,
      artifacts: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid schema name', () => {
    const result = WorkflowSchemaSchema.safeParse({
      ...validSchema,
      name: 'Invalid Name',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-positive version', () => {
    const result = WorkflowSchemaSchema.safeParse({
      ...validSchema,
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer version', () => {
    const result = WorkflowSchemaSchema.safeParse({
      ...validSchema,
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

// ─── ProjectConfigSchema ─────────────────────────────────────────────────

describe('ProjectConfigSchema', () => {
  it('should parse a full project config', () => {
    const result = ProjectConfigSchema.safeParse({
      schema: 'spec-driven',
      context: 'Tech stack: TypeScript, React, Node.js',
      rules: {
        proposal: ['Include rollback plan'],
        specs: ['Use Given/When/Then format'],
      },
      plugins: [
        {
          name: '@specforge/plugin-jira',
          config: { project: 'PROJ' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should use default schema when not provided', () => {
    const result = ProjectConfigSchema.parse({});
    expect(result.schema).toBe('spec-driven');
  });

  it('should accept minimal config (empty object)', () => {
    const result = ProjectConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept config with only context', () => {
    const result = ProjectConfigSchema.parse({
      context: 'We use Rust and PostgreSQL',
    });
    expect(result.context).toBe('We use Rust and PostgreSQL');
    expect(result.schema).toBe('spec-driven');
  });

  it('should reject rules with non-string arrays', () => {
    const result = ProjectConfigSchema.safeParse({
      rules: { proposal: [123] },
    });
    expect(result.success).toBe(false);
  });
});

// ─── ChangeMetadataSchema ─────────────────────────────────────────────────

describe('ChangeMetadataSchema', () => {
  const validMetadata = {
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T12:00:00Z',
    status: 'active',
  };

  it('should parse valid metadata', () => {
    const result = ChangeMetadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
  });

  it('should accept all valid statuses', () => {
    for (const status of ['active', 'completed', 'archived', 'abandoned']) {
      const result = ChangeMetadataSchema.safeParse({
        ...validMetadata,
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid status', () => {
    const result = ChangeMetadataSchema.safeParse({
      ...validMetadata,
      status: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should default status to active', () => {
    const result = ChangeMetadataSchema.parse({
      createdAt: '2025-01-15T10:30:00Z',
      updatedAt: '2025-01-15T12:00:00Z',
    });
    expect(result.status).toBe('active');
  });

  it('should reject non-ISO datetime strings', () => {
    const result = ChangeMetadataSchema.safeParse({
      ...validMetadata,
      createdAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional tags', () => {
    const result = ChangeMetadataSchema.parse({
      ...validMetadata,
      tags: ['frontend', 'urgent'],
    });
    expect(result.tags).toEqual(['frontend', 'urgent']);
  });

  it('should accept optional author', () => {
    const result = ChangeMetadataSchema.parse({
      ...validMetadata,
      author: 'dev@example.com',
    });
    expect(result.author).toBe('dev@example.com');
  });

  it('should accept optional schema override', () => {
    const result = ChangeMetadataSchema.parse({
      ...validMetadata,
      schema: 'tdd',
    });
    expect(result.schema).toBe('tdd');
  });
});

// ─── GlobalConfigSchema ──────────────────────────────────────────────────

describe('GlobalConfigSchema', () => {
  it('should parse a full global config', () => {
    const result = GlobalConfigSchema.safeParse({
      defaultSchema: 'tdd',
      ai: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-test-key',
      },
      git: {
        autoCommit: true,
        autoBranch: true,
        conventionalCommits: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it('should use defaults for minimal config', () => {
    const result = GlobalConfigSchema.parse({});
    expect(result.defaultSchema).toBe('spec-driven');
  });

  it('should accept all AI providers', () => {
    for (const provider of ['openai', 'anthropic', 'ollama']) {
      const result = GlobalConfigSchema.safeParse({
        ai: { provider },
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid AI provider', () => {
    const result = GlobalConfigSchema.safeParse({
      ai: { provider: 'invalid' },
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid base URL', () => {
    const result = GlobalConfigSchema.safeParse({
      ai: { baseUrl: 'not-a-url' },
    });
    expect(result.success).toBe(false);
  });

  it('should default git options', () => {
    const result = GlobalConfigSchema.parse({
      git: {},
    });
    expect(result.git?.autoCommit).toBe(false);
    expect(result.git?.autoBranch).toBe(false);
    expect(result.git?.conventionalCommits).toBe(true);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────

describe('safeParse', () => {
  it('should return success with data on valid input', () => {
    const result = safeParse(ProjectConfigSchema, { schema: 'tdd' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schema).toBe('tdd');
    }
  });

  it('should return errors on invalid input', () => {
    const result = safeParse(ChangeMetadataSchema, { createdAt: 'bad' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('formatZodErrors', () => {
  it('should format errors with paths', () => {
    const result = ChangeMetadataSchema.safeParse({
      createdAt: 'bad',
      updatedAt: 'bad',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = formatZodErrors(result.error);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m) => m.startsWith('createdAt:'))).toBe(true);
    }
  });

  it('should format root-level errors without path prefix', () => {
    const result = WorkflowSchemaSchema.safeParse({
      name: 'test',
      version: 1,
      description: 'Test',
      artifacts: [
        { id: 'a', generates: 'a.md', description: 'A', requires: [] },
        { id: 'a', generates: 'b.md', description: 'B', requires: [] },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = formatZodErrors(result.error);
      expect(messages.some((m) => m.includes('unique'))).toBe(true);
    }
  });
});
