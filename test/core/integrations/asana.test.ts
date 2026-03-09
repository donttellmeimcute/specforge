import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as asanaIntegration from '../../../src/core/integrations/asana.js';
import asana from 'asana';

// Configurar mocks manuales
const mockFindById = vi.fn();

vi.mock('asana', () => {
  return {
    default: {
      Client: {
        create: vi.fn(() => ({
          useAccessToken: vi.fn(() => ({
            tasks: {
              findById: mockFindById,
            },
          })),
        })),
      },
    },
  };
});

describe('Asana Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindById.mockReset();
  });

  it('should create an asana client with the provided token', () => {
    const token = 'test-token-123';
    const client = asanaIntegration.getAsanaClient(token);

    expect(client).toBeDefined();
    expect(asana.Client.create).toHaveBeenCalled();
  });

  it('should reuse the same client instance', () => {
    const token = 'test-token-123';
    const client1 = asanaIntegration.getAsanaClient(token);
    const client2 = asanaIntegration.getAsanaClient(token);

    expect(client1).toBe(client2);
  });

  it('should fetch a task and map its properties correctly', async () => {
    const mockTaskData = {
      gid: '123456',
      name: 'Test Task',
      notes: 'Task description',
      permalink_url: 'https://app.asana.com/0/123/123456',
      assignee: {
        gid: '9876',
        name: 'John Doe',
      },
    };

    mockFindById.mockResolvedValueOnce(mockTaskData);

    const task = await asanaIntegration.fetchAsanaTask('123456', 'fake-token');

    expect(mockFindById).toHaveBeenCalledWith('123456');
    expect(task).toEqual({
      id: '123456',
      name: 'Test Task',
      notes: 'Task description',
      permalink_url: 'https://app.asana.com/0/123/123456',
      assignee: {
        gid: '9876',
        name: 'John Doe',
      },
    });
  });

  it('should handle tasks without an assignee', async () => {
    const mockTaskData = {
      gid: '123456',
      name: 'Test Task Unassigned',
      notes: 'Task description',
      permalink_url: 'https://app.asana.com/0/123/123456',
      assignee: null,
    };

    mockFindById.mockResolvedValueOnce(mockTaskData);

    const task = await asanaIntegration.fetchAsanaTask('123456', 'fake-token');

    expect(task.assignee).toBeNull();
  });
});
