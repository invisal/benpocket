import type { HttpBodyType, HttpMethod } from '../../../preload/postman/types';
import type { KeyValueRow } from './lib/keyValueRows';

/** Binds a tab to a saved request, so a repeat Save updates it in place instead of creating a duplicate. */
export interface SavedBinding {
  collectionId: string;
  requestId: string;
}

/** Shape a Postman tab's `meta` may carry when opened pre-filled (from sidebar history or a saved request). */
export interface PostmanTabSeed {
  method?: HttpMethod;
  url?: string;
  headers?: KeyValueRow[];
  params?: KeyValueRow[];
  bodyType?: HttpBodyType;
  body?: string;
  wsUrl?: string;
  savedCollectionId?: string;
  savedRequestId?: string;
  /** For an unsaved tab opened via "new request in folder": where Save should target by default. */
  defaultCollectionId?: string;
  defaultFolderId?: string | null;
}
