/**
 * Namespaced Redis key builder.
 *
 * This module is the **only** place a service namespace prefix is applied.
 * `createRedisClient` is prefix-agnostic on purpose, so every key a service
 * writes goes through one builder and the format stays consistent:
 *
 *   <prefix><segment>:<segment>:...
 *
 * Example:
 *   const keys = createKeyBuilder("search:v1:");
 *   keys.namespace("v", 3, "q", hash)  →  "search:v1:v3:q:<hash>"
 *   keys.simple("namespace_version")   →  "search:v1:namespace_version"
 *
 * Because the prefix owns the namespace, never pass an already-prefixed key to
 * the package's helpers — that is how double prefixes (`search:v1:search:v1:`)
 * happen.
 */
export interface KeyBuilder {
  /**
   * Joins segments with ":" and prepends the service prefix.
   *
   * @example
   * builder.namespace("v", 1, "q", "abc123")
   * // → "<prefix>v:1:q:abc123"
   */
  namespace(...segments: (string | number)[]): string;

  /**
   * Builds a simple flat key: `<prefix><name>`.
   */
  simple(name: string): string;

  /**
   * Returns the normalised prefix string, always ending in ":".
   */
  prefix: string;
}

/**
 * Creates a `KeyBuilder` bound to the given prefix.
 *
 * A missing trailing ":" is added automatically so `createKeyBuilder("my:v1")`
 * and `createKeyBuilder("my:v1:")` produce identical keys.
 *
 * @param prefix - Namespace prefix for all keys, e.g. `"search:v1:"`.
 */
export function createKeyBuilder(prefix: string): KeyBuilder {
  const normalized = prefix.endsWith(":") ? prefix : `${prefix}:`;

  return {
    prefix: normalized,
    namespace(...segments: (string | number)[]): string {
      return `${normalized}${segments.join(":")}`;
    },
    simple(name: string): string {
      return `${normalized}${name}`;
    },
  };
}
