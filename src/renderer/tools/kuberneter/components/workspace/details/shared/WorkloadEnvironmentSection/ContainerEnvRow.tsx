import { memo, useCallback, type FC } from 'react';
import { Copy, Trash2, MoreVertical } from 'lucide-react';
import { KeyValueCodeEditor } from '../../KeyValueCodeEditor';
import { Menu } from '@renderer/components/ui/Menu';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';

interface ContainerEnvRowProps {
  id: string;
  name: string;
  value: string;
  onKeyChange: (id: string, newKey: string) => void;
  onValueChange: (id: string, newValue: string) => void;
  onDelete: (id: string) => void;
  onCopy: (key: string, value: string) => void;
}

export const ContainerEnvRow: FC<ContainerEnvRowProps> = memo(function ContainerEnvRow({
  id,
  name,
  value,
  onKeyChange,
  onValueChange,
  onDelete,
  onCopy
}: ContainerEnvRowProps) {
  const handleValueChange = useCallback(
    (newVal: string) => {
      onValueChange(id, newVal);
    },
    [id, onValueChange]
  );

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        render={
          <div
            id={`container-env-row-${id}`}
            className="grid grid-cols-[1fr_1.5fr_auto] gap-2 items-start px-3 py-1.5 border-b border-border/40 hover:bg-surface-2/40 transition-colors group"
          >
            {/* Environment Variable Name Input */}
            <div className="flex flex-col min-w-0">
              <input
                type="text"
                value={name}
                onChange={(e) => onKeyChange(id, e.target.value)}
                placeholder="VARIABLE_NAME"
                className="w-full h-8 px-2.5 bg-surface-2 border border-border/60 rounded text-xs font-mono text-foreground placeholder:text-zinc-600 focus:border-accent focus:bg-surface-1 outline-none transition-colors"
              />
            </div>

            {/* Environment Variable Value Input (KeyValueCodeEditor) */}
            <div className="flex flex-col min-w-0">
              <KeyValueCodeEditor
                value={value}
                onChange={handleValueChange}
                placeholder="Variable value..."
              />
            </div>

            {/* Row Actions Menu */}
            <div className="flex items-center justify-center shrink-0 pt-0.5 w-8">
              <Menu.Root>
                <Menu.Trigger
                  render={
                    <button
                      type="button"
                      title="Actions"
                      className="size-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-3 transition-colors border-none bg-transparent cursor-pointer"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>
                  }
                />
                <Menu.Content align="end" className="min-w-36">
                  <Menu.Item
                    onClick={() => onCopy(name, value)}
                    className="flex items-center gap-2 cursor-pointer text-xs"
                  >
                    <Copy className="size-3.5 text-zinc-400" />
                    <span>Copy Value</span>
                  </Menu.Item>
                  <Menu.Separator />
                  <Menu.Item
                    onClick={() => onDelete(id)}
                    className="flex items-center gap-2 cursor-pointer text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 focus:text-rose-300 focus:bg-rose-500/10"
                  >
                    <Trash2 className="size-3.5 text-rose-400" />
                    <span>Delete</span>
                  </Menu.Item>
                </Menu.Content>
              </Menu.Root>
            </div>
          </div>
        }
      />

      {/* Right-click Context Menu */}
      <ContextMenu.Content className="min-w-40">
        <ContextMenu.Item
          onClick={() => onCopy(name, value)}
          className="flex items-center gap-2 cursor-pointer text-xs"
        >
          <Copy className="size-3.5 text-zinc-400" />
          <span>Copy Value</span>
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item
          onClick={() => onDelete(id)}
          className="flex items-center gap-2 cursor-pointer text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 focus:text-rose-300 focus:bg-rose-500/10"
        >
          <Trash2 className="size-3.5 text-rose-400" />
          <span>Delete Variable</span>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
});
