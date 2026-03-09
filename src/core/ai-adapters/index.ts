export interface AIAssistantAdapter {
  id: string;
  name: string;
  generateInstruction(context: any, rules: string[], artifactTemplate: string): string;
  formatForAssistant(content: string): string;
}

export const cursorAdapter: AIAssistantAdapter = {
  id: 'cursor',
  name: 'Cursor IDE',
  generateInstruction(context, rules, template) {
    return `You are operating in Cursor IDE.
Project Context:
${context}

Rules for this artifact:
${rules.map((r) => `- ${r}`).join('\n')}

Output format expected:
${template}

Please generate the content now.`;
  },
  formatForAssistant(content) {
    return `<cursor-instruction>\n${content}\n</cursor-instruction>`;
  },
};

export const clineAdapter: AIAssistantAdapter = {
  id: 'cline',
  name: 'Cline',
  generateInstruction(context, rules, template) {
    return `[CLINE TASK]
CONTEXT:
${context}

RULES:
${rules.join('\n')}

TEMPLATE:
${template}

Please execute this task automatically.`;
  },
  formatForAssistant(content) {
    return `[SYSTEM_INSTRUCTION]\n${content}\n[/SYSTEM_INSTRUCTION]`;
  },
};

export const githubCopilotAdapter: AIAssistantAdapter = {
  id: 'copilot',
  name: 'GitHub Copilot',
  generateInstruction(context, rules, template) {
    return `@workspace I need to generate an artifact.
Context:
${context}

Rules:
${rules.join('\n')}

Format:
${template}`;
  },
  formatForAssistant(content) {
    return content; // Copilot usually just takes plain text in chat
  },
};

export const windsurfAdapter: AIAssistantAdapter = {
  id: 'windsurf',
  name: 'Windsurf',
  generateInstruction(context, rules, template) {
    return `Windsurf task generation:
Context: ${context}
Rules: ${rules.join(', ')}
Template: \n${template}`;
  },
  formatForAssistant(content) {
    return `<windsurf-context>\n${content}\n</windsurf-context>`;
  },
};

export const roocodeAdapter: AIAssistantAdapter = {
  id: 'roocode',
  name: 'RooCode',
  generateInstruction(context, rules, template) {
    return `[ROOCODE TASK]
CONTEXT:
${context}

RULES:
${rules.join('\n')}

TEMPLATE:
${template}

Please execute this task automatically.`;
  },
  formatForAssistant(content) {
    return `[SYSTEM_INSTRUCTION]\n${content}\n[/SYSTEM_INSTRUCTION]`;
  },
};

export const adapters = [
  cursorAdapter,
  clineAdapter,
  githubCopilotAdapter,
  windsurfAdapter,
  roocodeAdapter,
];

export function getAdapter(id: string): AIAssistantAdapter | undefined {
  return adapters.find((a) => a.id === id);
}
