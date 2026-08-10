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
    name: 'rename_entries',
    description:
      'Rename one or more files/folders in place, keeping each in its original directory. ' +
      'Pass every rename in a single call (one entry per file) instead of calling this once per file.',
    parameters: {
      type: 'object',
      properties: {
        renames: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute path of the file or folder to rename.'
              },
              newName: { type: 'string', description: 'New name (not a full path) for the entry.' }
            },
            required: ['path', 'newName']
          },
          description: 'List of {path, newName} pairs, one per file/folder to rename.'
        }
      },
      required: ['renames']
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
    name: 'move_entries',
    description:
      'Move one or more files/folders into a different directory in a single operation. ' +
      'Pass every path to move in one call instead of calling this once per file.',
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Absolute paths of the files/folders to move.'
        },
        destinationDirectory: {
          type: 'string',
          description: 'Absolute path of the directory to move them into.'
        }
      },
      required: ['paths', 'destinationDirectory']
    },
    mutates: true
  },
  {
    name: 'delete_entries',
    description:
      'Delete one or more files/folders in a single operation. On local disk these go to the ' +
      'trash/recycle bin; on R2 deletion is permanent. Pass every path to delete in one call ' +
      'instead of calling this once per file.',
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Absolute paths of the files/folders to delete.'
        }
      },
      required: ['paths']
    },
    mutates: true
  }
];

async function runListDirectory(args: { path: string }): Promise<AgentToolResult> {
  const result = await getDriverForLocation(args.path).listDirectory(args.path);
  if ('error' in result) return { error: result.error };
  return { success: true, result: result.entries };
}

async function runRenameEntries(args: {
  renames: { path: string; newName: string }[];
}): Promise<AgentToolResult> {
  if (args.renames.length === 0) return { error: 'No renames provided.' };

  const renamed: string[] = [];
  const failed: { path: string; error: string }[] = [];

  for (const { path: entryPath, newName } of args.renames) {
    const result = await getDriverForLocation(entryPath).renameEntry(entryPath, newName);
    if ('error' in result) failed.push({ path: entryPath, error: result.error });
    else renamed.push(entryPath);
  }

  return { success: true, result: { renamed, failed } };
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

async function runMoveEntries(args: {
  paths: string[];
  destinationDirectory: string;
}): Promise<AgentToolResult> {
  if (args.paths.length === 0) return { error: 'No paths provided.' };
  const result = await getDriverForLocation(args.paths[0]).moveEntries(
    args.paths,
    args.destinationDirectory
  );
  if ('error' in result) return { error: result.error };
  return { success: true, result: { moved: args.paths } };
}

async function runDeleteEntries(args: { paths: string[] }): Promise<AgentToolResult> {
  if (args.paths.length === 0) return { error: 'No paths provided.' };
  const result = await getDriverForLocation(args.paths[0]).deleteEntries(args.paths);
  if ('error' in result) return { error: result.error };
  return { success: true, result: { deleted: args.paths } };
}

export async function executeAgentTool(name: string, args: unknown): Promise<AgentToolResult> {
  switch (name) {
    case 'list_directory':
      return runListDirectory(args as { path: string });
    case 'rename_entries':
      return runRenameEntries(args as { renames: { path: string; newName: string }[] });
    case 'create_folder':
      return runCreateFolder(args as { parentPath: string; name: string });
    case 'create_folder_tree':
      return runCreateFolderTree(args as { parentPath: string; paths: string[] });
    case 'move_entries':
      return runMoveEntries(args as { paths: string[]; destinationDirectory: string });
    case 'delete_entries':
      return runDeleteEntries(args as { paths: string[] });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
