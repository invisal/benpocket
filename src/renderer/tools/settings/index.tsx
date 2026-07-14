import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { R2CredentialField } from './R2CredentialField';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function SettingsMain({}: ToolComponentProps<Props>) {
  return (
    <div className="flex-1 flex flex-col gap-6 p-8 overflow-y-auto bg-surface">
      <h1 className="text-xl font-semibold">Settings</h1>
      <R2CredentialField />
    </div>
  );
}

export default SettingsMain;
