import type { JSX, ReactNode } from 'react';

interface SettingsRowProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** One label+control row in SettingsPage -- siblings are separated by SettingsGroup's `divide-y`, not their own borders. */
export function SettingsRow({ title, description, children }: SettingsRowProps): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

interface SettingsGroupProps {
  title: string;
  children: ReactNode;
}

export function SettingsGroup({ title, children }: SettingsGroupProps): JSX.Element {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}
