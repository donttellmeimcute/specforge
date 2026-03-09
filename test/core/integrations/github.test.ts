import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as githubIntegration from '../../../src/core/integrations/github.js';
import { Octokit } from '@octokit/rest';
import * as childProcess from 'node:child_process';

// Mock Octokit
const mockCreatePull = vi.fn();
vi.mock('@octokit/rest', () => {
  return {
    Octokit: vi.fn().mockImplementation(() => ({
      rest: {
        pulls: {
          create: mockCreatePull,
        },
      },
    })),
  };
});

// Mock child_process
vi.mock('node:child_process', () => {
  return {
    execSync: vi.fn(),
  };
});

describe('GitHub Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatePull.mockReset();
    vi.mocked(Octokit).mockClear();
  });

  it('should create an Octokit client', () => {
    // Reset singleton specifically for this test
    githubIntegration._resetClient();
    
    const client = githubIntegration.getOctokitClient('test-token');
    expect(client).toBeDefined();
    // Since Octokit is a constructor, vi.mocked(Octokit) captures the calls
    expect(vi.mocked(Octokit)).toHaveBeenCalledWith({ auth: 'test-token' });
  });

  it('should reuse the same client instance', () => {
    githubIntegration._resetClient();
    
    const client1 = githubIntegration.getOctokitClient('test-token-again');
    const client2 = githubIntegration.getOctokitClient('test-token-again');
    
    expect(client1).toBe(client2);
    expect(vi.mocked(Octokit)).toHaveBeenCalledTimes(1);
  });

  it('should create a pull request via Octokit API', async () => {
    githubIntegration._resetClient();
    
    const mockResponseData = { html_url: 'https://github.com/owner/repo/pull/1' };
    mockCreatePull.mockResolvedValueOnce({ data: mockResponseData });
    
    const prOptions = {
      title: 'feat: Test PR',
      body: 'PR Body',
      head: 'feature-branch',
      base: 'main',
      owner: 'test-owner',
      repo: 'test-repo',
    };
    
    const result = await githubIntegration.createPullRequest(prOptions, 'fake-token');
    
    expect(mockCreatePull).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'feat: Test PR',
      body: 'PR Body',
      head: 'feature-branch',
      base: 'main',
    });
    
    expect(result).toEqual(mockResponseData);
  });

  it('should create a pull request via gh cli', () => {
    const mockExecSync = vi.mocked(childProcess.execSync);
    mockExecSync.mockReturnValueOnce(Buffer.from('https://github.com/owner/repo/pull/1\n'));
    
    const result = githubIntegration.createPullRequestWithGhCli('feat: Test PR', 'Resolves #123');
    
    expect(mockExecSync).toHaveBeenCalledWith(
      'gh pr create --title "feat: Test PR" --body "Resolves #123"'
    );
    expect(result).toBe('https://github.com/owner/repo/pull/1\n');
  });

  it('should escape quotes when using gh cli', () => {
    const mockExecSync = vi.mocked(childProcess.execSync);
    mockExecSync.mockReturnValueOnce(Buffer.from('success'));
    
    githubIntegration.createPullRequestWithGhCli('Title with "quotes"', 'Body with "quotes"');
    
    expect(mockExecSync).toHaveBeenCalledWith(
      'gh pr create --title "Title with \\"quotes\\"" --body "Body with \\"quotes\\""'
    );
  });

  it('should handle errors from gh cli gracefully', () => {
    const mockExecSync = vi.mocked(childProcess.execSync);
    const mockError = new Error('Command failed');
    mockExecSync.mockImplementationOnce(() => {
      throw mockError;
    });
    
    // Also mock console.error to avoid noise in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      githubIntegration.createPullRequestWithGhCli('title', 'body');
    }).toThrow('Command failed');
    
    expect(consoleSpy).toHaveBeenCalledWith('Error creating PR with gh cli', mockError);
    consoleSpy.mockRestore();
  });
});