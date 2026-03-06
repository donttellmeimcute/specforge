import { join } from 'node:path';
import { readTextFile } from '../../utils/file-system.js';
import { resolveSpecforgePath } from '../../utils/path-utils.js';
import { ArtifactGraph } from './graph.js';

/**
 * Load the instruction template + context for a specific artifact,
 * ready to be sent to an AI assistant.
 */
export async function loadInstructions(
  graph: ArtifactGraph,
  artifactId: string,
  _changeDir: string,
  projectRoot: string,
  context?: string,
  rules?: Record<string, string[]>,
): Promise<string> {
  const node = graph.getNode(artifactId);
  if (!node) {
    throw new Error(`Artifact "${artifactId}" not found in graph`);
  }

  const sections: string[] = [];

  // Header
  sections.push(`# Instructions: Generate "${artifactId}"`);
  sections.push('');

  // Artifact description
  sections.push(`## Artifact`);
  sections.push(`- **ID**: ${node.definition.id}`);
  sections.push(`- **Generates**: ${node.definition.generates}`);
  sections.push(`- **Description**: ${node.definition.description}`);
  sections.push('');

  // Project context
  if (context) {
    sections.push(`## Project Context`);
    sections.push(context);
    sections.push('');
  }

  // Rules for this artifact
  const artifactRules = rules?.[artifactId];
  if (artifactRules && artifactRules.length > 0) {
    sections.push(`## Rules`);
    for (const rule of artifactRules) {
      sections.push(`- ${rule}`);
    }
    sections.push('');
  }

  // Content of completed dependencies
  const deps = graph.getDependencies(artifactId);
  if (deps.length > 0) {
    sections.push(`## Completed Dependencies`);
    sections.push('');

    for (const depId of deps) {
      const depNode = graph.getNode(depId);
      if (!depNode || depNode.status !== 'completed') continue;

      for (const file of depNode.matchedFiles) {
        const content = await readTextFile(file);
        if (content) {
          sections.push(`### ${depId} (${file.split(/[/\\]/).pop()})`);
          sections.push('```');
          sections.push(content.trim());
          sections.push('```');
          sections.push('');
        }
      }
    }
  }

  // Template
  if (node.definition.template) {
    const templatePath = join(
      resolveSpecforgePath(projectRoot, 'schemas'),
      '..',
      'templates',
      node.definition.template,
    );
    const templateContent = await readTextFile(templatePath);
    if (templateContent) {
      sections.push(`## Template`);
      sections.push(templateContent.trim());
      sections.push('');
    }
  }

  // Output target
  sections.push(`## Output`);
  sections.push(
    `Write the content to: \`${node.definition.generates}\` inside the change directory.`,
  );

  return sections.join('\n');
}
