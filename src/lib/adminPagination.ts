/** Padrão administrativo do Painel Master: 50 registros por página. */
export const ADMIN_PAGE_SIZE = 50;

/** Intervalo (inclusive) para `.range(from, to)` do Supabase. Página começa em 1. */
export const getPageRange = (page: number, pageSize = ADMIN_PAGE_SIZE) => {
  const from = (Math.max(1, page) - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
};

export const getTotalPages = (totalItems: number, pageSize = ADMIN_PAGE_SIZE) =>
  Math.max(1, Math.ceil(totalItems / pageSize));

export const getRangeLabel = (page: number, totalItems: number, pageSize = ADMIN_PAGE_SIZE) => {
  if (totalItems === 0) return { start: 0, end: 0 };
  return {
    start: (page - 1) * pageSize + 1,
    end: Math.min(page * pageSize, totalItems),
  };
};

/**
 * Busca todas as linhas de uma consulta em blocos, sem o teto silencioso de
 * limit(100/200) nem o máximo de 1000 linhas por requisição.
 * `build` deve devolver a consulta já filtrada e com ordenação estável.
 */
export async function fetchAllRows<T = any>(
  build: () => any,
  chunk = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += chunk) {
    const { data, error } = await build().range(from, from + chunk - 1);
    if (error) throw error;
    all.push(...((data ?? []) as T[]));
    if (!data || data.length < chunk) break;
  }
  return all;
}
