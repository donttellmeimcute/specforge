import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Check if a path exists on disk */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Read a UTF-8 text file, returning null if it doesn't exist */
export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** Write a UTF-8 text file, creating parent directories as needed */
export async function writeTextFile(
  filePath: string,
  content: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

/** Ensure a directory exists */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}
