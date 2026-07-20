import { useState } from 'react';
import { Toolbar } from '@renderer/components/ui/Toolbar';
import { Input } from '@renderer/components/ui/Input';
import { Select } from '@renderer/components/ui/Select';
import { Button } from '@renderer/components/ui/Button';

const THEMES = ['System', 'Light', 'Dark'];

export function SettingsMockup() {
  const [name, setName] = useState('Ada Lovelace');
  const [email, setEmail] = useState('ada@benpocket.dev');
  const [theme, setTheme] = useState('System');

  return (
    <div className="flex h-[32rem] w-full flex-col overflow-hidden rounded-md border border-border">
      <Toolbar.Root>
        <span className="px-3 text-[13px] font-medium">Preferences</span>
        <div className="flex-1" />
        <Toolbar.Button>Cancel</Toolbar.Button>
        <Toolbar.Button>Save</Toolbar.Button>
      </Toolbar.Root>

      <div className="flex-1 overflow-y-auto bg-surface-2 p-6">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
            <h3 className="text-xs font-medium text-muted-foreground">Profile</h3>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground">Email</span>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </section>

          <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
            <h3 className="text-xs font-medium text-muted-foreground">Appearance</h3>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground">Theme</span>
              <Select.Root value={theme} onValueChange={(value) => setTheme(value as string)}>
                <Select.Trigger className="w-full justify-between">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {THEMES.map((t) => (
                    <Select.Item key={t} value={t}>
                      {t}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </label>
          </section>

          <div className="flex justify-end gap-2">
            <Button variant="outline">Reset to defaults</Button>
            <Button variant="primary">Save changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
