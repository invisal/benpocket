import type React from 'react';
import { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useProfilesStore } from '../../store/profiles.store';

const API_BASE_URL = 'https://benpocket.com';

type Step =
  | { kind: 'connect' }
  | { kind: 'connecting' }
  | { kind: 'create-password'; apiBaseUrl: string; accessToken: string; refreshToken: string }
  | {
      kind: 'enter-password';
      apiBaseUrl: string;
      accessToken: string;
      refreshToken: string;
      wrappedDek: string;
      kdfSalt: string;
    };

interface GithubLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * GitHub PKCE login -> master-password create-or-unlock -> creates a
 * `kind: 'remote'` profile. See src/main/store/PLAN3.md for the full flow;
 * RemoteSyncProvider itself is still an unimplemented stub, so the resulting
 * profile's secrets aren't persisted for sync yet -- a known, accepted gap
 * until that lands.
 */
export const GithubLoginDialog: React.FC<GithubLoginDialogProps> = ({ open, onOpenChange }) => {
  const createProfile = useProfilesStore((state) => state.createProfile);

  const [name, setName] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'connect' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  function reset(): void {
    setName('');
    setStep({ kind: 'connect' });
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setIsBusy(false);
  }

  function close(): void {
    reset();
    onOpenChange(false);
  }

  async function handleConnect(): Promise<void> {
    setError(null);
    setIsBusy(true);
    setStep({ kind: 'connecting' });

    const loginResult = await window.auth.loginGithub(API_BASE_URL);
    if (!loginResult.ok) {
      setIsBusy(false);
      setError(loginResult.error);
      setStep({ kind: 'connect' });
      return;
    }
    const { accessToken, refreshToken } = loginResult;

    const statusResult = await window.auth.getAccountKeyStatus(API_BASE_URL, accessToken);
    setIsBusy(false);
    if (!statusResult.ok) {
      setError(statusResult.error);
      setStep({ kind: 'connect' });
      return;
    }

    if (statusResult.status.hasKey) {
      setStep({
        kind: 'enter-password',
        apiBaseUrl: API_BASE_URL,
        accessToken,
        refreshToken,
        wrappedDek: statusResult.status.wrappedDek,
        kdfSalt: statusResult.status.kdfSalt
      });
    } else {
      setStep({ kind: 'create-password', apiBaseUrl: API_BASE_URL, accessToken, refreshToken });
    }
  }

  async function handleCreatePassword(): Promise<void> {
    if (step.kind !== 'create-password') return;

    if (password.length < 8) {
      setError('Master password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsBusy(true);
    const result = await window.auth.setupMasterPassword(
      step.apiBaseUrl,
      step.accessToken,
      password
    );
    setIsBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    await finish(step.apiBaseUrl, step.accessToken, step.refreshToken, result.dek);
  }

  async function handleUnlock(): Promise<void> {
    if (step.kind !== 'enter-password') return;

    if (!password) {
      setError('Enter your master password.');
      return;
    }

    setError(null);
    setIsBusy(true);
    const result = await window.auth.unlockMasterPassword(step.wrappedDek, step.kdfSalt, password);
    setIsBusy(false);
    if (!result.ok) {
      // Wrong password is retryable -- keep the dialog open, let the user try again.
      setError(result.error);
      setPassword('');
      return;
    }

    await finish(step.apiBaseUrl, step.accessToken, step.refreshToken, result.dek);
  }

  async function finish(
    profileApiBaseUrl: string,
    accessToken: string,
    refreshToken: string,
    dek: Uint8Array
  ): Promise<void> {
    setIsBusy(true);
    const profile = await createProfile(name.trim() || 'GitHub', {
      kind: 'remote',
      apiBaseUrl: profileApiBaseUrl,
      provider: 'github',
      refreshToken,
      token: accessToken,
      dek
    });
    setIsBusy(false);
    if (!profile) {
      setError('Could not create the profile.');
      return;
    }
    close();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <Dialog.Content>
        <Dialog.Title>Sign in with GitHub</Dialog.Title>
        <Dialog.Description>
          {step.kind === 'connect' && 'Connect a BenPocket account to sync across devices.'}
          {step.kind === 'connecting' && 'Connecting to your account…'}
          {step.kind === 'create-password' &&
            'Create a master password to protect your synced data. This cannot be recovered if forgotten.'}
          {step.kind === 'enter-password' &&
            'Enter your master password to unlock your synced data.'}
        </Dialog.Description>

        <div className="mt-4 flex flex-col gap-3">
          {step.kind === 'connect' && (
            <>
              <Input
                placeholder="Profile name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isBusy}
              />
              <Button variant="primary" onClick={() => void handleConnect()} disabled={isBusy}>
                Continue with GitHub
              </Button>
            </>
          )}

          {step.kind === 'connecting' && (
            <p className="text-[13px] text-muted-foreground">
              Complete sign-in in your browser, then come back here.
            </p>
          )}

          {step.kind === 'create-password' && (
            <>
              <Input
                type="password"
                placeholder="Master password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isBusy}
              />
              <Input
                type="password"
                placeholder="Confirm master password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isBusy}
              />
              <Button
                variant="primary"
                onClick={() => void handleCreatePassword()}
                disabled={isBusy}
              >
                Create master password
              </Button>
            </>
          )}

          {step.kind === 'enter-password' && (
            <>
              <Input
                type="password"
                placeholder="Master password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isBusy}
              />
              <Button variant="primary" onClick={() => void handleUnlock()} disabled={isBusy}>
                Unlock
              </Button>
            </>
          )}

          {error && <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
};
