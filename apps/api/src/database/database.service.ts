import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

/**
 * 事务里拿到的连接。
 *
 * 只暴露 `query`，因为我们只用它跑 SQL —— 不该在业务代码里碰连接的生命周期。
 * 接口和 `DatabaseService.query` 一致，所以同一段 SQL 在事务内外都能复用。
 */
export type Queryable = Pick<PoolClient, 'query'>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | undefined;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const connectionString = this.config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    this.pool = new Pool({ connectionString });
    try {
      const name = await this.currentDatabase();
      if (name !== 'onesoon') {
        throw new Error(`Expected database onesoon, connected to ${name}`);
      }
      await this.applySchema('passenger.sql');
      await this.applySchema('driver.sql');
      await this.applySchema('vehicle.sql');
      // dispatch.sql 依赖 driver 与 trip_order，必须放在它们之后
      await this.applySchema('dispatch.sql');
      this.logger.log(`Connected to database ${name}`);
    } catch (error) {
      await this.pool.end();
      this.pool = undefined;
      throw error;
    }
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database is not connected');
    }
    return this.pool.query<T>(text, values);
  }

  /**
   * 在一个事务里跑一组 SQL。
   *
   * 任何一步抛异常都会回滚，不会留下「订单接了、推送没改」这种半截状态。
   * 抢单场景靠它 + `SELECT ... FOR UPDATE` 行锁配合：同一订单的并发接单会串行化。
   */
  async transaction<T>(run: (client: Queryable) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database is not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async currentDatabase(): Promise<string> {
    if (!this.pool) {
      throw new Error('Database is not connected');
    }

    const result = await this.pool.query<{ name: string }>(
      'SELECT current_database() AS name',
    );
    const name = result.rows[0]?.name;
    if (!name) {
      throw new Error('Database is not connected');
    }
    return name;
  }

  private async applySchema(fileName: string): Promise<void> {
    const sqlPath = join(dirname(fileURLToPath(import.meta.url)), fileName);
    const statements = readFileSync(sqlPath, 'utf8')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      await this.query(statement);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = undefined;
  }
}
