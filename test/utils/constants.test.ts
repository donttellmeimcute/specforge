import { describe, it, expect } from 'vitest';
import {
  SPECFORGE_DIR,
  CONFIG_FILE,
  SPECS_DIR,
  CHANGES_DIR,
  SCHEMAS_DIR,
  ARCHIVE_DIR,
  METADATA_FILE,
} from '../../src/utils/constants.js';

describe('constants', () => {
  it('should have expected values', () => {
    expect(SPECFORGE_DIR).toBe('.specforge');
    expect(CONFIG_FILE).toBe('config.yaml');
    expect(SPECS_DIR).toBe('specs');
    expect(CHANGES_DIR).toBe('changes');
    expect(SCHEMAS_DIR).toBe('schemas');
    expect(ARCHIVE_DIR).toBe('archive');
    expect(METADATA_FILE).toBe('.metadata.yaml');
  });
});
