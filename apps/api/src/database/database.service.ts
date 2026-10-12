import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getConnectionTimeout, getDatabaseUrl } from './database.config';

type DatabaseTransaction = Parameters<
  Parameters<NodePgDatabase['transaction']>[0]
>[0];

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  public readonly db: NodePgDatabase;

  constructor() {
    this.pool = new Pool({
      connectionString: getDatabaseUrl(),
      connectionTimeoutMillis: getConnectionTimeout(),
    });

    this.db = drizzle({
      client: this.pool,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.verifyConnection();
    } catch {
      await this.pool.end();
      throw new Error('Database connection verification failed');
    }
  }

  async verifyConnection(): Promise<void> {
    await this.db.execute(sql`SELECT 1`);
  }

  async transaction<T>(
    work: (tx: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(work);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
