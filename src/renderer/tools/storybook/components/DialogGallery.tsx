import { useState } from 'react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { Section, Swatch } from './Section';

export function DialogGallery() {
  const [open, setOpen] = useState(false);

  return (
    <Section title="Dialog" description="Modal, built on @base-ui/react.">
      <Swatch label="controlled dialog">
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
      </Swatch>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content>
          <Dialog.Title>Delete workspace?</Dialog.Title>
          <Dialog.Description>
            This action can&apos;t be undone. All requests and environments in this workspace will
            be removed.
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setOpen(false)}>
              Delete
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </Section>
  );
}
