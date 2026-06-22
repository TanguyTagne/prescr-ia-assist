/**
 * Paginate through a Supabase table query, bypassing PostgREST's
 * default 1000-row per-request cap. Each page requests at most `pageSize`
 * rows via `.range()`, so the aggregate result is limited only by `maxRows`.
 */
export async function fetchAll<T>(
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
