import type React from 'react';
import { useState } from 'react';
import { KubeTable } from '../../kubeTable';

export interface PropertyItem {
  id: string;
  name: string;
  value: React.ReactNode;
  hasDetail?: boolean;
  renderDetail?: () => React.ReactNode;
}

interface KubePropertiesTableProps {
  properties: PropertyItem[];
}

export const KubePropertiesTable: React.FC<KubePropertiesTableProps> = ({ properties }) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string | number>>(new Set());

  const handleRowClick = (row: PropertyItem) => {
    if (row.hasDetail) {
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(row.id)) {
          next.delete(row.id);
        } else {
          next.add(row.id);
        }
        return next;
      });
    }
  };

  const renderRowExpansion = (row: PropertyItem) => {
    if (row.renderDetail) {
      return row.renderDetail();
    }
    return null;
  };

  const columns = [
    {
      key: 'name',
      header: 'Property',
      render: (row: PropertyItem) => (
        <span className="text-[10px] text-zinc-555 uppercase tracking-wider font-semibold">
          {row.name}
        </span>
      ),
      initialWidth: 120
    },
    {
      key: 'value',
      header: 'Value',
      render: (row: PropertyItem) => (
        <span className="font-mono text-zinc-300 break-all w-full block">{row.value}</span>
      ),
      initialWidth: 320
    }
  ];

  return (
    <div className="border-y border-border/40 flex flex-col h-auto w-full overflow-y-auto">
      <KubeTable<PropertyItem>
        columns={columns}
        data={properties}
        getRowKey={(row) => row.id}
        showHeader={false}
        resizable={false}
        onRowClick={handleRowClick}
        renderRowExpansion={renderRowExpansion}
        expandedRowKeys={expandedKeys}
      />
    </div>
  );
};
