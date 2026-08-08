import type {
  HttpAuth,
  HttpBodyType,
  HttpMethod,
  HttpResponsePayload,
  RequestProtocol
} from '../../../preload/http-client/types';
import type { KeyValueRow } from './lib/keyValueRows';

/** Binds a tab to a saved request, so a repeat Save updates it in place instead of creating a duplicate. */
export interface SavedBinding {
  collectionId: string;
  requestId: string;
}

/** Shape a Postman tab's `meta` may carry when opened pre-filled (from sidebar history or a saved request). */
export interface PostmanTabSeed {
  /** Which protocol tab to land on when opening this seed. Defaults to 'HTTP' when omitted. */
  protocol?: RequestProtocol;
  method?: HttpMethod;
  url?: string;
  headers?: KeyValueRow[];
  params?: KeyValueRow[];
  bodyType?: HttpBodyType;
  body?: string;
  auth?: HttpAuth;
  wsUrl?: string;
  savedCollectionId?: string;
  savedRequestId?: string;
  /** For an unsaved tab opened via "new request in folder": where Save should target by default. */
  defaultCollectionId?: string;
  defaultFolderId?: string | null;
  /** Set when this tab was opened from a saved example: preloads the response without sending, and identifies which example is active (for sidebar highlighting). Deliberately not bound via `savedCollectionId`/`savedRequestId` - editing an example view and Ctrl+S should save as a new request, not silently overwrite the parent. */
  response?: HttpResponsePayload;
  savedExampleId?: string;
}
