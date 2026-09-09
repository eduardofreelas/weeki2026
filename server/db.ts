import pg from "pg";
export interface Sql {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends Sql {
  transaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
}
export function database(
  connectionString: string,
): Database & { close(): Promise<void> } {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  return {
    query: async <T>(text: string, values?: unknown[]) => ({
      rows: (await pool.query(text, values)).rows as T[],
    }),
    close: () => pool.end(),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(client as Sql);
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}
