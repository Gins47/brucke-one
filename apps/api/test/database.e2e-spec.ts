import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';

describe('DatabaseModule (integration)', () => {
  it('connects through the shared provider, runs a transaction, and closes the pool', async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();
    const database = module.get(DatabaseService);

    try {
      await module.init();
      expect(module.get(DatabaseService)).toBe(database);
      await expect(database.verifyConnection()).resolves.toBeUndefined();
      const result = await database.transaction((tx) =>
        tx.execute<{ value: number }>(sql`SELECT 1 AS value`),
      );
      expect(result.rows).toEqual([{ value: 1 }]);
    } finally {
      await module.close();
    }

    await expect(database.verifyConnection()).rejects.toThrow();
  });
});
