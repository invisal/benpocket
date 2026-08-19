export interface LiteralEnvEntry {
  id: string;
  name: string;
  value: string;
}

export type EnvVarSourceType = 'configMap' | 'secret' | 'field' | 'resource';

export interface ReferencedEnvEntry {
  id: string;
  name: string;
  sourceType: EnvVarSourceType;
  refName?: string;
  refKey?: string;
  fieldPath?: string;
  resource?: string;
  optional?: boolean;
}

export interface EnvFromEntry {
  id: string;
  sourceType: 'configMap' | 'secret';
  name: string;
  prefix?: string;
  optional?: boolean;
}
