/**
 * AI Provider abstraction for generating artifact content.
 * Supports OpenAI, Anthropic, Ollama (local), and Claude Code (local CLI).
 */

export interface AIProvider {
  name: string;
  generate(prompt: string, options?: AIGenerateOptions): Promise<string>;
}

export interface AIGenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'claude-code';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Create an AI provider from config.
 * Uses dynamic imports so SDKs are only loaded when needed.
 */
export async function createAIProvider(config: AIConfig): Promise<AIProvider> {
  switch (config.provider) {
    case 'openai':
      return createOpenAIProvider(config);
    case 'anthropic':
      return createAnthropicProvider(config);
    case 'ollama':
      return createOllamaProvider(config);
    case 'claude-code':
      return createClaudeCodeProvider(config);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

async function createOpenAIProvider(config: AIConfig): Promise<AIProvider> {
  const apiKey = config.apiKey ?? process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'OpenAI API key not configured. Set OPENAI_API_KEY or configure in global config.',
    );
  }

  return {
    name: 'openai',
    async generate(prompt: string, options?: AIGenerateOptions): Promise<string> {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({
        apiKey,
        baseURL: config.baseUrl,
      });

      const response = await client.chat.completions.create({
        model: options?.model ?? config.model ?? 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
      });

      return response.choices[0]?.message?.content ?? '';
    },
  };
}

async function createAnthropicProvider(config: AIConfig): Promise<AIProvider> {
  const apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'Anthropic API key not configured. Set ANTHROPIC_API_KEY or configure in global config.',
    );
  }

  return {
    name: 'anthropic',
    async generate(prompt: string, options?: AIGenerateOptions): Promise<string> {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({
        apiKey,
        baseURL: config.baseUrl,
      });

      const response = await client.messages.create({
        model: options?.model ?? config.model ?? 'claude-sonnet-4-20250514',
        max_tokens: options?.maxTokens ?? 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find((c) => c.type === 'text');
      return textBlock?.text ?? '';
    },
  };
}

async function createOllamaProvider(config: AIConfig): Promise<AIProvider> {
  const baseUrl = config.baseUrl ?? 'http://localhost:11434';

  return {
    name: 'ollama',
    async generate(prompt: string, options?: AIGenerateOptions): Promise<string> {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options?.model ?? config.model ?? 'llama3',
          prompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 4096,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { response: string };
      return data.response;
    },
  };
}

async function createClaudeCodeProvider(config: AIConfig): Promise<AIProvider> {
  return {
    name: 'claude-code',
    async generate(prompt: string, options?: AIGenerateOptions): Promise<string> {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);

      const args = ['--print', prompt];

      const model = options?.model ?? config.model;
      if (model) {
        args.unshift('--model', model);
      }

      const maxTokens = options?.maxTokens;
      if (maxTokens) {
        args.unshift('--max-turns', '1');
      }

      try {
        const commandName = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        const finalArgs = ['--no-install', 'claude', ...args];
        
        const { stdout } = await execFileAsync(commandName, finalArgs, {
          maxBuffer: 1024 * 1024 * 10, // 10 MB
          timeout: 300_000, // 5 min
          shell: process.platform === 'win32' // Required on Windows to resolve .cmd correctly
        });
        return stdout;
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'ENOENT') {
          throw new Error(
            'Claude Code CLI not found. Install it with: npm install -g @anthropic-ai/claude-code',
          );
        }
        throw new Error(`Claude Code error: ${err.message ?? String(error)}`);
      }
    },
  };
}
