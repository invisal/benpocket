import type React from 'react';
import { useState } from 'react';
import { KubeTable } from '../../kubeTable';
import { ChevronDown, ChevronRight } from 'lucide-react';

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

  const handleToggleExpand = (row: PropertyItem) => {
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

  const columns = [
    {
      key: 'name',
      header: 'Property',
      render: (row: PropertyItem) => (
        <span className="text-[10px] text-zinc-555 uppercase tracking-wider font-semibold select-none">
          {row.name}
        </span>
      ),
      initialWidth: 120
    },
    {
      key: 'value',
      header: 'Value',
      render: (row: PropertyItem) => {
        const isExpanded = expandedKeys.has(row.id);
        return (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="font-mono text-zinc-300 break-all select-text flex-1">
                {row.value}
              </span>
              {row.hasDetail && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleExpand(row);
                  }}
                  className="text-zinc-500 hover:text-zinc-350 cursor-pointer p-0.5 rounded hover:bg-surface-3/50 transition-colors border-none bg-transparent flex items-center justify-center shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </button>
              )}
            </div>
            {isExpanded && row.renderDetail && (
              <div className="mt-1 pb-1 border-t border-border/10 pt-1.5 w-full">
                {row.renderDetail()}
              </div>
            )}
          </div>
        );
      },
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
        expandedRowKeys={expandedKeys}
      />
    </div>
  );
};
