import type { Collection, HttpAuth } from '../../../../preload/http-client/types';
import { DEFAULT_HTTP_AUTH } from './auth';
import { findFolderById, findFolderChainForRequest } from './collectionTree';

/**
 * Resolves a request's `auth` against its collection/folder ancestry: an explicit
 * (non-'inherit') auth always wins, otherwise walks from the request's immediate
 * folder up to the collection root and uses the nearest ancestor with a concrete
 * auth type. Falls back to no-auth if nothing up the chain sets one.
 */
export function resolveInheritedAuth(
  auth: HttpAuth,
  collection: Collection | undefined,
  requestId: string | undefined
): HttpAuth {
  if (auth.type !== 'inherit') return auth;
  if (!collection || !requestId) return DEFAULT_HTTP_AUTH;

  const chain = findFolderChainForRequest(collection, requestId) ?? [];
  for (let i = chain.length - 1; i >= 0; i--) {
    const folder = findFolderById(collection.folders, chain[i]);
    if (folder?.auth && folder.auth.type !== 'inherit') return folder.auth;
  }

  if (collection.auth && collection.auth.type !== 'inherit') return collection.auth;
  return DEFAULT_HTTP_AUTH;
}
