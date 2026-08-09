export const MUTATING_TOOLS = new Set([
  'rename_entries',
  'create_folder',
  'create_folder_tree',
  'move_entries',
  'delete_entries'
]);

export function isMutatingTool(name: string): boolean {
  return MUTATING_TOOLS.has(name);
}

function baseName(fullPath: string): string {
  return fullPath.split(/[\\/]/).filter(Boolean).pop() ?? fullPath;
}

/** Caps how many item names are spelled out in an approval card before collapsing into "and N more". */
const MAX_LISTED_ITEMS = 5;

function formatEntryList(names: string[]): string {
  const shown = names.slice(0, MAX_LISTED_ITEMS).map((n) => `\`${n}\``);
  const remaining = names.length - shown.length;
  return remaining > 0 ? `${shown.join(', ')}, and ${remaining} more` : shown.join(', ');
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
    case 'rename_entries': {
      const renames = Array.isArray(args.renames)
        ? (args.renames as { path: string; newName: string }[])
        : [];
      if (renames.length === 1) {
        return `Rename \`${baseName(renames[0].path)}\` → \`${renames[0].newName}\``;
      }
      const names = renames.map((r) => `${baseName(r.path)} → ${r.newName}`);
      return `Rename ${renames.length} items: ${formatEntryList(names)}`;
    }
    case 'create_folder':
      return `Create folder \`${args.name}\` in \`${args.parentPath}\``;
    case 'create_folder_tree': {
      const paths = Array.isArray(args.paths) ? (args.paths as string[]) : [];
      return `Create ${paths.length} folder${paths.length === 1 ? '' : 's'} under \`${args.parentPath}\`: ${paths.map((p) => `\`${p}\``).join(', ')}`;
    }
    case 'move_entries': {
      const paths = Array.isArray(args.paths) ? (args.paths as string[]) : [];
      if (paths.length === 1) {
        return `Move \`${baseName(paths[0])}\` to \`${args.destinationDirectory}\``;
      }
      return `Move ${paths.length} items to \`${args.destinationDirectory}\`: ${formatEntryList(paths.map(baseName))}`;
    }
    case 'delete_entries': {
      const paths = Array.isArray(args.paths) ? (args.paths as string[]) : [];
      if (paths.length === 1) {
        return `Delete \`${baseName(paths[0])}\``;
      }
      return `Delete ${paths.length} items: ${formatEntryList(paths.map(baseName))}`;
    }
    default:
      return `Run ${name}`;
  }
}
