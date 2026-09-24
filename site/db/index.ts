import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';

import * as schema from './schema';

export type SqlRow = Record<string, unknown>;

export interface SqlClient {
  one<T extends object = SqlRow>(
    query: string,
    values?: readonly unknown[],
  ): Promise<T | null>;
  many<T extends object = SqlRow>(
    query: string,
    values?: readonly unknown[],
  ): Promise<T[]>;
  execute(query: string, values?: readonly unknown[]): Promise<number>;
}

class PostgresClient implements SqlClient {
  constructor(private readonly executor: Pool | PoolClient) {}

  async one<T extends object = SqlRow>(
    query: string,
    values: readonly unknown[] = [],
  ): Promise<T | null> {
    const result = await this.executor.query(query, [...values]);
    return (result.rows[0] as T | undefined) ?? null;
  }

  async many<T extends object = SqlRow>(
    query: string,
    values: readonly unknown[] = [],
  ): Promise<T[]> {
    const result = await this.executor.query(query, [...values]);
    return result.rows as T[];
  }

  async execute(
    query: string,
    values: readonly unknown[] = [],
  ): Promise<number> {
    const result = await this.executor.query(query, [...values]);
    return result.rowCount ?? 0;
  }
}

export class PostgresDatabase extends PostgresClient {
  constructor(private readonly pool: Pool) {
    super(pool);
  }

  async transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
    const connection = await this.pool.connect();
    try {
      await connection.query('BEGIN');
      const result = await work(new PostgresClient(connection));
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }
  }
}

const globalForPostgres = globalThis as typeof globalThis & {
  goujianPostgresPool?: Pool;
  goujianPostgresDatabase?: PostgresDatabase;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少数据库环境变量 ${name}`);
  return value;
}

export function getPool(): Pool {
  if (!globalForPostgres.goujianPostgresPool) {
    const port = Number(process.env.PGPORT || '5432');
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error('PGPORT 必须是有效端口号');
    }
    globalForPostgres.goujianPostgresPool = new Pool({
      host: requiredEnvironment('PGHOST'),
      port,
      database: requiredEnvironment('PGDATABASE'),
      user: requiredEnvironment('PGUSER'),
      password: requiredEnvironment('PGPASSWORD'),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForPostgres.goujianPostgresPool;
}

export function database(): PostgresDatabase {
  globalForPostgres.goujianPostgresDatabase ??= new PostgresDatabase(getPool());
  return globalForPostgres.goujianPostgresDatabase;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
