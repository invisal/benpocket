import type React from 'react';
import type { HttpAuth, HttpAuthType } from '../../../../preload/http-client/types';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { AUTH_TYPE_OPTIONS, authTypeLabel } from '../lib/auth';
import { VariableSuggestInput } from './VariableSuggestInput';
import { OAuth2AuthFields } from './OAuth2AuthFields';
import { Select } from '@renderer/components/ui/Select';
import { fieldInputClass, fieldLabelClass } from './authFieldStyles';

const APIKEY_LOCATION_LABELS: Record<'header' | 'query', string> = {
  header: 'Header',
  query: 'Query Params'
};

interface AuthEditorProps {
  auth: HttpAuth;
  onChange: (auth: HttpAuth) => void;
}

/** Authorization tab: pick an auth type, fill its fields, values support `{{var}}`. */
export const AuthEditor: React.FC<AuthEditorProps> = ({ auth, onChange }) => {
  const variables = useActiveEnvironmentVariables();

  return (
    <div className="flex flex-col gap-3 max-w-md">
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Type</span>
        <Select.Root
          value={auth.type}
          onValueChange={(value) => onChange({ ...auth, type: value as HttpAuthType })}
        >
          <Select.Trigger size="sm" className="w-full justify-between">
            {/* base-ui's Select.Value renders the raw value ("noauth"), so render the label ourselves. */}
            <Select.Value>{(value: HttpAuthType) => authTypeLabel(value)}</Select.Value>
          </Select.Trigger>
          <Select.Content side="bottom" align="start">
            {AUTH_TYPE_OPTIONS.map((opt) => (
              <Select.Item key={opt.value} value={opt.value}>
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </label>

      {auth.type === 'inherit' && (
        <p className="text-[11px] text-muted-foreground italic">
          Uses the auth configured on the parent folder/collection, or no auth if none of them have
          one set.
        </p>
      )}

      {auth.type === 'noauth' && (
        <p className="text-[11px] text-muted-foreground italic">
          This request does not use any authorization.
        </p>
      )}

      {auth.type === 'bearer' && (
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Token</span>
          <VariableSuggestInput
            value={auth.bearer?.token ?? ''}
            onChange={(token) => onChange({ ...auth, bearer: { token } })}
            variables={variables}
            placeholder="Token or {{var}}"
            className={fieldInputClass}
          />
        </label>
      )}

      {auth.type === 'basic' && (
        <>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Username</span>
            <VariableSuggestInput
              value={auth.basic?.username ?? ''}
              onChange={(username) =>
                onChange({ ...auth, basic: { username, password: auth.basic?.password ?? '' } })
              }
              variables={variables}
              placeholder="Username or {{var}}"
              className={fieldInputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Password</span>
            <VariableSuggestInput
              value={auth.basic?.password ?? ''}
              onChange={(password) =>
                onChange({ ...auth, basic: { username: auth.basic?.username ?? '', password } })
              }
              variables={variables}
              placeholder="Password or {{var}}"
              className={fieldInputClass}
            />
          </label>
        </>
      )}

      {auth.type === 'apikey' && (
        <>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Key</span>
            <VariableSuggestInput
              value={auth.apikey?.key ?? ''}
              onChange={(key) =>
                onChange({
                  ...auth,
                  apikey: { key, value: auth.apikey?.value ?? '', in: auth.apikey?.in ?? 'header' }
                })
              }
              variables={variables}
              placeholder="Key"
              className={fieldInputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Value</span>
            <VariableSuggestInput
              value={auth.apikey?.value ?? ''}
              onChange={(value) =>
                onChange({
                  ...auth,
                  apikey: { key: auth.apikey?.key ?? '', value, in: auth.apikey?.in ?? 'header' }
                })
              }
              variables={variables}
              placeholder="Value or {{var}}"
              className={fieldInputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Add to</span>
            <Select.Root
              value={auth.apikey?.in ?? 'header'}
              onValueChange={(value) =>
                onChange({
                  ...auth,
                  apikey: {
                    key: auth.apikey?.key ?? '',
                    value: auth.apikey?.value ?? '',
                    in: value as 'header' | 'query'
                  }
                })
              }
            >
              <Select.Trigger size="sm" className="w-full justify-between">
                <Select.Value>
                  {(value: 'header' | 'query') => APIKEY_LOCATION_LABELS[value]}
                </Select.Value>
              </Select.Trigger>
              <Select.Content side="bottom" align="start">
                <Select.Item value="header">
                  <Select.ItemText>Header</Select.ItemText>
                </Select.Item>
                <Select.Item value="query">
                  <Select.ItemText>Query Params</Select.ItemText>
                </Select.Item>
              </Select.Content>
            </Select.Root>
          </label>
        </>
      )}

      {auth.type === 'oauth2' && (
        <OAuth2AuthFields
          oauth2={auth.oauth2}
          onChange={(oauth2) => onChange({ ...auth, oauth2 })}
          variables={variables}
        />
      )}
    </div>
  );
};
