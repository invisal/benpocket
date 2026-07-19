import * as fs from 'fs';
import * as path from 'path';
import { getDriverForLocation } from '../driverRegistry';
import type { AgentToolResult } from './types';

export interface AgentToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments, in OpenAI function-calling format. */
  parameters: Record<string, unknown>;
  /** Whether this tool changes the filesystem -- gates whether the UI asks for approval. */
  mutates: boolean;
}

export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'list_directory',
    description: 'List the files and folders directly inside a directory.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path of the directory to list.' }
      },
      required: ['path']
    },
    mutates: false
  },
  {
    name: 'rename_entry',
    description: 'Rename a single file or folder in place, keeping it in the same directory.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path of the file or folder to rename.' },
        newName: { type: 'string', description: 'New name (not a full path) for the entry.' }
      },
      required: ['path', 'newName']
    },
    mutates: true
  },
  {
    name: 'create_folder',
    description: 'Create a single new folder inside an existing directory.',
    parameters: {
      type: 'object',
      properties: {
        parentPath: { type: 'string', description: 'Absolute path of the parent directory.' },
        name: { type: 'string', description: 'Name of the new folder (not a full path).' }
      },
      required: ['parentPath', 'name']
    },
    mutates: true
  },
  {
    name: 'create_folder_tree',
    description:
      'Scaffold multiple folders at once under a parent directory, e.g. to set up a project skeleton. Each entry is a path relative to parentPath and may include slashes to create nested folders in one step.',
    parameters: {
      type: 'object',
      properties: {
        parentPath: { type: 'string', description: 'Absolute path of the parent directory.' },
        paths: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Relative folder paths to create, e.g. ["src", "src/components", "src/lib", "tests"].'
        }
      },
      required: ['parentPath', 'paths']
    },
    mutates: true
  },
  {
    name: 'move_entry',
    description: 'Move a single file or folder into a different directory.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path of the file or folder to move.' },
        destinationDirectory: {
          type: 'string',
          description: 'Absolute path of the directory to move it into.'
        }
      },
      required: ['path', 'destinationDirectory']
    },
    mutates: true
  },
  {
    name: 'delete_entry',
    description:
      'Delete a single file or folder. On local disk this goes to the trash/recycle bin; on R2 it is permanent.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path of the file or folder to delete.' }
      },
      required: ['path']
    },
    mutates: true
  }
];

async function runListDirectory(args: { path: string }): Promise<AgentToolResult> {
  const result = await getDriverForLocation(args.path).listDirectory(args.path);
  if ('error' in result) return { error: result.error };
  return { success: true, result: result.entries };
}

async function runRenameEntry(args: { path: string; newName: string }): Promise<AgentToolResult> {
  const result = await getDriverForLocation(args.path).renameEntry(args.path, args.newName);
  if ('error' in result) return { error: result.error };
  return { success: true, result: { renamed: true } };
}

async function runCreateFolder(args: {
  parentPath: string;
  name: string;
}): Promise<AgentToolResult> {
  const result = await getDriverForLocation(args.parentPath).createFolder(
    args.parentPath,
    args.name
  );
  if ('error' in result) return { error: result.error };
  return { success: true, result: { path: result.path } };
}

async function runCreateFolderTree(args: {
  parentPath: string;
  paths: string[];
}): Promise<AgentToolResult> {
  const created: string[] = [];
  const failed: { path: string; error: string }[] = [];

  for (const relativePath of args.paths) {
    const fullPath = path.join(args.parentPath, relativePath);
    try {
      await fs.promises.mkdir(fullPath, { recursive: true });
      created.push(fullPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ path: fullPath, error: message });
    }
  }

  return { success: true, result: { created, failed } };
}

async function runMoveEntry(args: {
  path: string;
  destinationDirectory: string;
}): Promise<AgentToolResult> {
  const result = await getDriverForLocation(args.path).moveEntries(
    [args.path],
    args.destinationDirectory
  );
  if ('error' in result) return { error: result.error };
  return { success: true, result: { moved: true } };
}

async function runDeleteEntry(args: { path: string }): Promise<AgentToolResult> {
  const result = await getDriverForLocation(args.path).deleteEntries([args.path]);
  if ('error' in result) return { error: result.error };
  return { success: true, result: { deleted: true } };
}

export async function executeAgentTool(name: string, args: unknown): Promise<AgentToolResult> {
  switch (name) {
    case 'list_directory':
      return runListDirectory(args as { path: string });
    case 'rename_entry':
      return runRenameEntry(args as { path: string; newName: string });
    case 'create_folder':
      return runCreateFolder(args as { parentPath: string; name: string });
    case 'create_folder_tree':
      return runCreateFolderTree(args as { parentPath: string; paths: string[] });
    case 'move_entry':
      return runMoveEntry(args as { path: string; destinationDirectory: string });
    case 'delete_entry':
      return runDeleteEntry(args as { path: string });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
