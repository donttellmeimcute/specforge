// Optional peer dependencies — installed by users only when needed

declare module 'openai' {
  class OpenAI {
    constructor(config: { apiKey: string; baseURL?: string });
    chat: {
      completions: {
        create(params: {
          model: string;
          messages: Array<{ role: string; content: string }>;
          max_tokens?: number;
          temperature?: number;
        }): Promise<{
          choices: Array<{ message: { content: string | null } }>;
        }>;
      };
    };
  }
  export default OpenAI;
}

declare module '@anthropic-ai/sdk' {
  class Anthropic {
    constructor(config: { apiKey: string; baseURL?: string });
    messages: {
      create(params: {
        model: string;
        max_tokens: number;
        messages: Array<{ role: string; content: string }>;
      }): Promise<{
        content: Array<{ type: string; text?: string }>;
      }>;
    };
  }
  export default Anthropic;
}

declare module 'simple-git' {
  interface SimpleGit {
    checkIsRepo(): Promise<boolean>;
    branchLocal(): Promise<{ current: string }>;
    checkoutLocalBranch(name: string): Promise<void>;
    add(files: string | string[]): Promise<void>;
    commit(message: string): Promise<void>;
    status(): Promise<{
      not_added: string[];
      modified: string[];
      deleted: string[];
      renamed: Array<{ from: string; to: string }>;
      created: string[];
    }>;
  }
  export function simpleGit(basePath: string): SimpleGit;
}
