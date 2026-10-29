import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

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
      await this.applyPassengerSchema();
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

  private async applyPassengerSchema(): Promise<void> {
    const sqlPath = join(
      dirname(fileURLToPath(import.meta.url)),
      'passenger.sql',
    );
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
