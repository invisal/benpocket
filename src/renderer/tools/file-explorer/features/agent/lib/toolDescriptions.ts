export const MUTATING_TOOLS = new Set([
  'rename_entry',
  'create_folder',
  'create_folder_tree',
  'move_entry',
  'delete_entry'
]);

export function isMutatingTool(name: string): boolean {
  return MUTATING_TOOLS.has(name);
}

function baseName(fullPath: string): string {
  return fullPath.split(/[\\/]/).filter(Boolean).pop() ?? fullPath;
}

/** Turns a tool call's raw JSON arguments into a one-line, human-readable summary for the approval card. */
export function describeToolCall(name: string, argsJson: string): string {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson) as Record<string, unknown>;
  } catch {
    return `Run ${name}`;
  }

  switch (name) {
    case 'list_directory':
      return `List contents of \`${args.path}\``;
    case 'rename_entry':
      return `Rename \`${baseName(String(args.path))}\` → \`${args.newName}\``;
    case 'create_folder':
      return `Create folder \`${args.name}\` in \`${args.parentPath}\``;
    case 'create_folder_tree': {
      const paths = Array.isArray(args.paths) ? (args.paths as string[]) : [];
      return `Create ${paths.length} folder${paths.length === 1 ? '' : 's'} under \`${args.parentPath}\`: ${paths.map((p) => `\`${p}\``).join(', ')}`;
    }
    case 'move_entry':
      return `Move \`${baseName(String(args.path))}\` to \`${args.destinationDirectory}\``;
    case 'delete_entry':
      return `Delete \`${baseName(String(args.path))}\``;
    default:
      return `Run ${name}`;
  }
}
