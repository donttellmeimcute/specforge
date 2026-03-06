import { describe, it, expect } from 'vitest';
import { logger } from '../../src/utils/logger.js';

describe('logger', () => {
  it('should expose all log levels', () => {
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.success).toBe('function');
    expect(typeof logger.out).toBe('function');
  });

  it('should accept verbose toggle', () => {
    expect(() => logger.setVerbose(true)).not.toThrow();
    expect(() => logger.setVerbose(false)).not.toThrow();
  });
});
