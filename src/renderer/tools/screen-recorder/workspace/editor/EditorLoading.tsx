import { Loader2 } from 'lucide-react';

export default function EditorLoading() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-activity-bg">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <p className="font-medium text-muted-foreground">Loading Editor</p>
    </div>
  );
}
