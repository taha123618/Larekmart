/**
 * Namespaced Redis key builder.
 *
 * Centralises key construction so every service uses a consistent format:
 *
 *   <prefix><namespace>:<rest>
 *
 * Example:
 *   const keys = createKeyBuilder("search:v1:");
 *   keys.namespace("v", 3, "query", hash)  →  "search:v1:v3:query:<hash>"
 *   keys.simple("health")                  →  "search:v1:health"
 */
export interface KeyBuilder {
  /**
   * Joins segments with ":" and prepends the service prefix.
   *
   * @example
   * builder.namespace("v", 1, "q", "abc123")
   * // → "<prefix>v1:q:abc123"
   */
  namespace(...segments: (string | number)[]): string;

  /**
   * Builds a simple flat key: `<prefix><name>`.
   */
  simple(name: string): string;

  /**
   * Returns the raw prefix string.
   */
  prefix: string;
}

/**
 * Creates a `KeyBuilder` bound to the given prefix.
 *
 * @param prefix - Namespace prefix for all keys, e.g. `"search:v1:"`.
 */
export function createKeyBuilder(prefix: string): KeyBuilder {
  return {
    prefix,
    namespace(...segments: (string | number)[]): string {
      return `${prefix}${segments.join(":")}`;
    },
    simple(name: string): string {
      return `${prefix}${name}`;
    },
  };
}
