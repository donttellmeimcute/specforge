import { z } from 'zod';

// ─── Artifact Definition (inside a schema YAML) ──────────────────────────

/** A single artifact node within a workflow schema */
export const ArtifactDefinitionSchema = z.object({
  /** Unique identifier within the schema (e.g. "proposal", "specs", "design") */
  id: z
    .string()
    .min(1)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      'Must be lowercase alphanumeric with hyphens, starting with a letter',
    ),

  /** File or glob pattern this artifact generates (relative to the change dir) */
  generates: z.string().min(1),

  /** Human-readable description */
  description: z.string().min(1),

  /** Template file name to use when generating instructions */
  template: z.string().optional(),

  /** IDs of artifacts that must be completed before this one */
  requires: z.array(z.string()).default([]),
});

export type ArtifactDefinition = z.infer<typeof ArtifactDefinitionSchema>;

// ─── Workflow Schema (the full YAML file) ─────────────────────────────────

/** A complete workflow schema definition */
export const WorkflowSchemaSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      'Must be lowercase alphanumeric with hyphens',
    ),

  version: z.number().int().positive(),

  description: z.string().min(1),

  artifacts: z
    .array(ArtifactDefinitionSchema)
    .min(1, 'At least one artifact is required')
    .refine(
      (artifacts) => {
        const ids = artifacts.map((a) => a.id);
        return new Set(ids).size === ids.length;
      },
      { message: 'Artifact IDs must be unique' },
    )
    .refine(
      (artifacts) => {
        const ids = new Set(artifacts.map((a) => a.id));
        return artifacts.every((a) =>
          a.requires.every((dep) => ids.has(dep)),
        );
      },
      { message: 'All dependency references must point to existing artifact IDs' },
    ),
});

export type WorkflowSchema = z.infer<typeof WorkflowSchemaSchema>;

// ─── Project Configuration (.specforge/config.yaml) ───────────────────────

/** Plugin configuration entry */
export const PluginConfigSchema = z.object({
  name: z.string().min(1),
  config: z.record(z.unknown()).optional(),
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;

/** Project-level configuration */
export const ProjectConfigSchema = z.object({
  /** Which workflow schema to use */
  schema: z.string().default('spec-driven'),

  /** Free-text project context (tech stack, conventions, etc.) */
  context: z.string().optional(),

  /** Per-artifact rules */
  rules: z.record(z.array(z.string())).optional(),

  /** Plugin configurations */
  plugins: z.array(PluginConfigSchema).optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// ─── Change Metadata (.metadata.yaml inside each change) ─────────────────

export const ChangeStatus = z.enum([
  'active',
  'completed',
  'archived',
  'abandoned',
]);

export type ChangeStatus = z.infer<typeof ChangeStatus>;

export const ChangeMetadataSchema = z.object({
  /** Schema used for this change (overrides project config) */
  schema: z.string().optional(),

  /** ISO 8601 creation timestamp */
  createdAt: z.string().datetime(),

  /** ISO 8601 last-updated timestamp */
  updatedAt: z.string().datetime(),

  /** Current status */
  status: ChangeStatus.default('active'),

  /** Optional tags for categorization */
  tags: z.array(z.string()).optional(),

  /** Author identifier */
  author: z.string().optional(),
});

export type ChangeMetadata = z.infer<typeof ChangeMetadataSchema>;

// ─── Artifact State (runtime, derived from filesystem) ────────────────────

export const ArtifactStatus = z.enum([
  'pending',
  'ready',
  'in-progress',
  'completed',
  /** Files exist but one or more upstream dependencies are not yet completed (out-of-order editing). */
  'diverged',
  /** Completed, but one or more dependency files are newer — may need re-sync. */
  'needs-sync',
]);

export type ArtifactStatus = z.infer<typeof ArtifactStatus>;

/** Runtime state of an artifact — not persisted, derived from filesystem */
export interface ArtifactState {
  /** The artifact definition */
  definition: ArtifactDefinition;

  /** Current computed status */
  status: ArtifactStatus;

  /** Files that match the generates pattern (empty if none exist) */
  matchedFiles: string[];
}

// ─── Global user configuration (~/.config/specforge/config.yaml) ──────────

export const GlobalConfigSchema = z.object({
  /** Default schema to use when initializing new projects */
  defaultSchema: z.string().default('spec-driven'),

  /** AI provider configuration */
  ai: z
    .object({
      provider: z.enum(['openai', 'anthropic', 'ollama', 'claude-code']).optional(),
      model: z.string().optional(),
      apiKey: z.string().optional(),
      baseUrl: z.string().url().optional(),
    })
    .optional(),

  /** Git integration settings */
  git: z
    .object({
      autoCommit: z.boolean().default(false),
      autoBranch: z.boolean().default(false),
      conventionalCommits: z.boolean().default(true),
    })
    .optional(),
    
  /** Opt-in or opt-out of anonymous usage telemetry */
  telemetry: z.boolean().optional(),
  
  /** Unique anonymous ID for telemetry */
  telemetryId: z.string().optional(),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

// ─── Parsing helpers ──────────────────────────────────────────────────────

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodError };

/** Safely parse data against a Zod schema, returning a discriminated result */
export function safeParse<O, D extends z.ZodTypeDef, I>(
  schema: z.ZodType<O, D, I>,
  data: unknown,
): ParseResult<O> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/** Format Zod errors into human-readable messages */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') + ': ' : '';
    return `${path}${issue.message}`;
  });
}
