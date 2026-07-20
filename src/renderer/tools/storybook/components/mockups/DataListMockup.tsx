import { useCallback, useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table';
import { Search, Plus } from 'lucide-react';
import { Toolbar } from '@renderer/components/ui/Toolbar';
import { ListView } from '@renderer/components/ui/ListView';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';

interface Member {
  id: string;
  name: string;
  role: string;
  status: 'Active' | 'Invited';
}

const MEMBERS: Member[] = [
  { id: '1', name: 'Ada Lovelace', role: 'Engineer', status: 'Active' },
  { id: '2', name: 'Grace Hopper', role: 'Engineer', status: 'Active' },
  { id: '3', name: 'Alan Turing', role: 'Researcher', status: 'Invited' },
  { id: '4', name: 'Katherine Johnson', role: 'Analyst', status: 'Active' },
  { id: '5', name: 'Margaret Hamilton', role: 'Engineer', status: 'Invited' },
  { id: '6', name: 'Radia Perlman', role: 'Engineer', status: 'Active' },
  { id: '7', name: 'Hedy Lamarr', role: 'Researcher', status: 'Invited' }
];

const columns: ColumnDef<Member>[] = [
  { accessorKey: 'name', header: 'Name', size: 220 },
  { accessorKey: 'role', header: 'Role', size: 160 },
  { accessorKey: 'status', header: 'Status', size: 120 }
];

export function DataListMockup() {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const data = useMemo(
    () => MEMBERS.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table memoizes its own return value; not a React Compiler concern
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const getRowId = useCallback((row: Member) => row.id, []);
  const getRowLabel = useCallback((row: Member) => row.name, []);

  return (
    <div className="flex h-[32rem] w-full flex-col overflow-hidden rounded-md border border-border">
      <Toolbar.Root>
        <Toolbar.Button shape="square">
          <Search size={14} />
        </Toolbar.Button>
        <Toolbar.Input
          placeholder="Search team members..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-56"
        />
        <div className="flex-1" />
        <Toolbar.Button>
          <Plus size={14} />
          Add member
        </Toolbar.Button>
      </Toolbar.Root>

      <div className="relative flex flex-1 flex-col min-h-0">
        <ListView
          table={table}
          getRowId={getRowId}
          getRowLabel={getRowLabel}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          renderContextMenu={() => (
            <>
              <ContextMenu.Item>Rename</ContextMenu.Item>
              <ContextMenu.Item>Resend invite</ContextMenu.Item>
              <ContextMenu.Separator />
              <ContextMenu.Item>Remove</ContextMenu.Item>
            </>
          )}
          emptyState={
            <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
              No members match &quot;{query}&quot;
            </div>
          }
        />
      </div>
    </div>
  );
}
