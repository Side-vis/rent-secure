/**
 * Supabase types an embedded relation (e.g. `profiles(full_name)`) as an array
 * unless generated DB types say otherwise, but one-to-one joins return a single
 * object at runtime. This normalizes either shape to a single row or null.
 */
export function firstEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
