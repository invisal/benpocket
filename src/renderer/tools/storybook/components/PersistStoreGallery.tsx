import { useEffect, useState, type SubmitEvent } from 'react';
import * as Y from 'yjs';
import { Trash2 } from 'lucide-react';
import { usePersistStore } from '@renderer/hooks/usePersistStore';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { Section } from './Section';

const DOC_KEY = 'testing_list';

// Re-renders whenever `map` changes (locally, or via a snapshot load /
// profile switch swapping in a whole new Y.Doc) -- proves usePersistStore's
// doc is a live, observable Yjs type, not a one-shot snapshot.
function useYMapEntries(map: Y.Map<string>): [string, string][] {
  const [entries, setEntries] = useState<[string, string][]>(() => Array.from(map.entries()));

  useEffect(() => {
    const sync = (): void => setEntries(Array.from(map.entries()));
    sync();
    map.observe(sync);
    return () => map.unobserve(sync);
  }, [map]);

  return entries;
}

export function PersistStoreGallery() {
  const { isLoading, doc } = usePersistStore(DOC_KEY, () => new Y.Doc());
  const map = doc.getMap<string>(DOC_KEY);
  const entries = useYMapEntries(map);
  const [draft, setDraft] = useState('');

  const handleAdd = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    map.set(crypto.randomUUID(), text);
    setDraft('');
  };

  return (
    <Section
      title="Persist Store"
      description={`usePersistStore('${DOC_KEY}', () => new Y.Doc()) -- add, edit, and remove items below, then reload the app or switch profiles (top-left profile switcher) to confirm changes persist and stay isolated per profile.`}
    >
      <div className="w-full max-w-md">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="New item..."
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !draft.trim()}>
            Add
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-2">
          {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
          {!isLoading && entries.length === 0 && (
            <p className="text-xs text-muted-foreground">No items yet.</p>
          )}
          {entries.map(([id, text]) => (
            <div
              key={id}
              className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5"
            >
              <Input
                size="sm"
                value={text}
                onChange={(event) => map.set(id, event.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => map.delete(id)}
                aria-label="Remove item"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
