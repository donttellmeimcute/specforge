import asana from 'asana';

export interface AsanaTask {
  id: string;
  name: string;
  notes: string;
  permalink_url: string;
  assignee?: {
    gid: string;
    name: string;
  } | null;
  // Añadimos campos adicionales si es necesario
}

let asanaClient: asana.Client | null = null;

export function getAsanaClient(token: string): asana.Client {
  if (!asanaClient) {
    asanaClient = asana.Client.create().useAccessToken(token);
  }
  return asanaClient;
}

export async function fetchAsanaTask(taskId: string, token: string): Promise<AsanaTask> {
  const client = getAsanaClient(token);
  const task = await client.tasks.findById(taskId);

  return {
    id: task.gid,
    name: task.name,
    notes: task.notes,
    permalink_url: task.permalink_url,
    assignee: task.assignee,
  };
}
