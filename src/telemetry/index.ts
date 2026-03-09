import { PostHog } from 'posthog-node';
import { loadGlobalConfig } from '../core/global-config.js';
import * as crypto from 'node:crypto';

let client: PostHog | null = null;
let distinctId: string | null = null;

// Replace with a real public key if deploying to production
const POSTHOG_API_KEY = 'phc_dummy_key_replace_me';

export async function initTelemetry() {
  const globalConfig = await loadGlobalConfig();
  
  // Opt-in / Opt-out logic
  if (globalConfig.telemetry === false) {
    return;
  }
  
  // Generate a distinct anonymous ID for this machine if none exists
  if (!globalConfig.telemetryId) {
    globalConfig.telemetryId = crypto.randomUUID();
    const { saveGlobalConfig } = await import('../core/global-config.js');
    await saveGlobalConfig(globalConfig);
  }
  
  distinctId = globalConfig.telemetryId;

  client = new PostHog(
    POSTHOG_API_KEY,
    { host: 'https://eu.posthog.com', flushAt: 1, flushInterval: 0 } // sync flush for CLI
  );
}

export function trackCommand(command: string, properties: Record<string, any> = {}) {
  if (!client || !distinctId) return;

  client.capture({
    distinctId,
    event: 'cli_command_executed',
    properties: {
      command,
      ...properties,
      os: process.platform,
      node_version: process.version
    }
  });
}

export function trackError(command: string, error: Error) {
  if (!client || !distinctId) return;

  client.capture({
    distinctId,
    event: 'cli_command_error',
    properties: {
      command,
      error_message: error.message,
      error_name: error.name
    }
  });
}

export async function closeTelemetry() {
  if (client) {
    await client.shutdown();
  }
}