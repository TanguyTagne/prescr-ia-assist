/**
 * Paginate a Supabase PostgREST query from an Edge Function.
 * PostgREST caps single responses to `max_rows` (default 1000);
 * this helper loops with `.range()` until the table is exhausted
 * or `maxRows` is reached.
 */
export async function fetchAllPages<T>(
  build: () => any,
  pageSize = 1000,
  maxRows = 100_000
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return out;
}
