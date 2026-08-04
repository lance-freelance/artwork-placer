/**
 * Domain types for the felt-board art placement experience.
 *
 * The shapes are owned by the OpenAPI contract and generated from it, so the
 * board, the admin panel and the server can never drift apart. Everything is
 * read from the API at runtime — nothing here is hardcoded content.
 */

export type {
  ArtObject,
  ObjectType,
  Placement,
  Room,
} from '@workspace/api-client-react';

/**
 * Resolve a `/public` asset path against the artifact's base URL.
 * Never build these URLs with a leading slash — the app is served under a
 * base path prefix.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
