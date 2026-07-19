import { cn } from 'cnfast';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap',
          isUser ? 'bg-accent text-emphasis-text' : 'bg-surface-2 text-foreground'
        )}
      >
        {content}
      </div>
    </div>
  );
}
