export interface ReadPage<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

/** Read every row from a paginated source instead of silently accepting its first page. */
export async function readAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<ReadPage<T>>,
  pageSize = 500,
): Promise<ReadPage<T>> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError("Page size must be a positive integer.");
  }

  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    if (page.error) return { data: null, error: page.error };
    const batch = page.data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return { data: rows, error: null };
  }
}
