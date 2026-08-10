import type React from 'react';
import { useState } from 'react';
import type { KeyValuePair } from '../../../../preload/http-client/types';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { resolveVariables } from '../lib/variables';
import { getCachedOAuth2Token, getOrFetchOAuth2Token } from '../lib/oauth2TokenCache';
import { VariableSuggestInput } from './VariableSuggestInput';
import { fieldInputClass, fieldLabelClass } from './authFieldStyles';

interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

interface OAuth2AuthFieldsProps {
  oauth2: OAuth2Config | undefined;
  onChange: (oauth2: OAuth2Config) => void;
  variables: KeyValuePair[];
}

/** Client Credentials grant only - fields plus a manual "Get New Access Token" fetch/refresh. */
export const OAuth2AuthFields: React.FC<OAuth2AuthFieldsProps> = ({
  oauth2,
  onChange,
  variables
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const tokenUrl = oauth2?.tokenUrl ?? '';
  const clientId = oauth2?.clientId ?? '';
  const clientSecret = oauth2?.clientSecret ?? '';
  const scope = oauth2?.scope ?? '';

  const resolvedConfig: OAuth2Config = {
    tokenUrl: resolveVariables(tokenUrl, variables),
    clientId: resolveVariables(clientId, variables),
    clientSecret: resolveVariables(clientSecret, variables),
    scope: scope ? resolveVariables(scope, variables) : undefined
  };
  const cachedToken = getCachedOAuth2Token(resolvedConfig);

  const handleGetToken = async (): Promise<void> => {
    setStatus('loading');
    setError(null);
    try {
      await getOrFetchOAuth2Token(resolvedConfig, { force: true });
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to fetch access token.');
    }
  };

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Token URL</span>
        <VariableSuggestInput
          value={tokenUrl}
          onChange={(value) => onChange({ tokenUrl: value, clientId, clientSecret, scope })}
          variables={variables}
          placeholder="https://example.com/oauth/token"
          className={fieldInputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Client ID</span>
        <VariableSuggestInput
          value={clientId}
          onChange={(value) => onChange({ tokenUrl, clientId: value, clientSecret, scope })}
          variables={variables}
          placeholder="Client ID"
          className={fieldInputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Client Secret</span>
        <Input
          type="password"
          value={clientSecret}
          onChange={(e) => onChange({ tokenUrl, clientId, clientSecret: e.target.value, scope })}
          placeholder="Client Secret"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Scope</span>
        <VariableSuggestInput
          value={scope}
          onChange={(value) => onChange({ tokenUrl, clientId, clientSecret, scope: value })}
          variables={variables}
          placeholder="Optional, space-separated"
          className={fieldInputClass}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={status === 'loading' || !tokenUrl || !clientId}
          onClick={() => void handleGetToken()}
        >
          {status === 'loading' ? 'Fetching…' : 'Get New Access Token'}
        </Button>
        {status !== 'loading' && cachedToken && (
          <p className="text-[11px] text-zinc-600">
            Token cached, expires {new Date(cachedToken.expiresAt).toLocaleTimeString()}.
          </p>
        )}
        {status !== 'loading' && !cachedToken && !error && (
          <p className="text-[11px] text-zinc-600 italic">
            No token fetched yet - one will be requested automatically on Send.
          </p>
        )}
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>
    </>
  );
};
