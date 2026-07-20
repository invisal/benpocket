import { useCallback, useState } from 'react';
import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table';
import { ListView } from '@renderer/components/ui/ListView';
import { Section } from './Section';

interface DemoRow {
  id: string;
  name: string;
  role: string;
  status: 'Active' | 'Invited';
}

const DATA: DemoRow[] = [
  { id: '1', name: 'Ada Lovelace', role: 'Engineer', status: 'Active' },
  { id: '2', name: 'Grace Hopper', role: 'Engineer', status: 'Active' },
  { id: '3', name: 'Alan Turing', role: 'Researcher', status: 'Invited' },
  { id: '4', name: 'Katherine Johnson', role: 'Analyst', status: 'Active' },
  { id: '5', name: 'Margaret Hamilton', role: 'Engineer', status: 'Invited' }
];

const columns: ColumnDef<DemoRow>[] = [
  { accessorKey: 'name', header: 'Name', size: 200 },
  { accessorKey: 'role', header: 'Role', size: 140 },
  { accessorKey: 'status', header: 'Status', size: 100 }
];

export function ListViewGallery() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table memoizes its own return value; not a React Compiler concern
  const table = useReactTable({ data: DATA, columns, getCoreRowModel: getCoreRowModel() });
  const getRowId = useCallback((row: DemoRow) => row.id, []);
  const getRowLabel = useCallback((row: DemoRow) => row.name, []);

  return (
    <Section
      title="List View"
      description="Virtualized, selectable row list built on @tanstack/react-table + react-virtual."
    >
      <div className="h-56 w-full overflow-hidden rounded-md border border-border">
        <div className="flex h-full flex-col">
          <ListView
            table={table}
            getRowId={getRowId}
            getRowLabel={getRowLabel}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>
      </div>
    </Section>
  );
}
