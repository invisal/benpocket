import type React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import type { HttpMethod } from '../../../../preload/http-client/types';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { looksLikeCurlCommand, parseCurlCommand, type ParsedCurlRequest } from '../lib/curlImport';
import { VariableSuggestInput } from './VariableSuggestInput';
import { Menu } from '@renderer/components/ui/Menu';
import { Button } from '@renderer/components/ui/Button';
import { methodBadgeClass } from '../lib/methodBadge';

/** The address bar's method selector doubles as the HTTP/WebSocket protocol switch. */
export type ComposerMethod = HttpMethod | 'WEBSOCKET';

const METHODS: { value: ComposerMethod; label: string }[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
  { value: 'WEBSOCKET', label: 'WebSocket' }
];

interface ComposerAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

interface RequestComposerProps {
  method: ComposerMethod;
  onMethodChange: (method: ComposerMethod) => void;
  url: string;
  onUrlChange: (url: string) => void;
  urlDisabled?: boolean;
  action: ComposerAction;
  /** Pasting a `curl ...` command into the URL field fills the whole request instead of
   * dropping the raw command text in as the URL - HTTP mode only (undefined in WebSocket
   * mode disables the interception, since there's nothing to import into). */
  onImportCurl?: (parsed: ParsedCurlRequest) => void;
  /** Extra icon buttons rendered between the address bar and the primary action, e.g. Save/Code. */
  extraActions?: React.ReactNode;
}

export const RequestComposer: React.FC<RequestComposerProps> = ({
  method,
  onMethodChange,
  url,
  onUrlChange,
  urlDisabled,
  action,
  onImportCurl,
  extraActions
}) => {
  const variables = useActiveEnvironmentVariables();
  const selectedLabel = METHODS.find((m) => m.value === method)?.label ?? method;

  return (
    <div className="flex items-center gap-2 px-3 mt-3 shrink-0">
      {/* URL input, extra actions (Code/Save) and Send all live in one flat, borderless
          group - matching the sidebar header's flat style and reading as a single control
          rather than separate boxed elements. */}
      <div className="flex items-center flex-1 min-w-0 gap-1 h-7 rounded bg-surface-2 border border-border pl-2 pr-1 h-10">
        <Menu.Root>
          <Menu.Trigger className="flex items-center gap-1 h-7 px-2 rounded text-sm font-medium hover:bg-surface-2 cursor-pointer shrink-0">
            <span className={methodBadgeClass(method)}>{selectedLabel}</span>
            <ChevronDownIcon size={14} />
          </Menu.Trigger>
          <Menu.Content align="start">
            {METHODS.map((m) => (
              <Menu.Item key={m.value} onClick={() => onMethodChange(m.value)}>
                <span className={methodBadgeClass(m.value)}>{m.label}</span>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Root>
        <VariableSuggestInput
          value={url}
          onChange={onUrlChange}
          variables={variables}
          disabled={urlDisabled}
          onEnter={() => {
            if (!action.disabled) action.onClick();
          }}
          onPaste={
            onImportCurl &&
            ((e) => {
              const text = e.clipboardData.getData('text');
              if (!looksLikeCurlCommand(text)) return;
              const parsed = parseCurlCommand(text);
              if (!parsed) return;
              e.preventDefault();
              onImportCurl(parsed);
            })
          }
          className="flex-1 h-full min-w-0 outline-none text-sm bg-transparent disabled:opacity-60 w-full border-border border-l px-3"
          placeholder="Enter request URL, e.g. https://api.example.com/v1/resource or {{base_url}}/... - or paste a curl command"
        />
        <Button
          variant="ghost"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.label}
          className={'hover:bg-list-selected size-8 p-0 m-0'}
        >
          {action.icon}
        </Button>
      </div>

      {extraActions}
    </div>
  );
};
