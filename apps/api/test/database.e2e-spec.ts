import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module.js';
import { DatabaseService } from './../src/database/database.service.js';

describe('onesoon database (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('connects to the onesoon database', async () => {
    const database = app.get(DatabaseService);
    await expect(database.currentDatabase()).resolves.toBe('onesoon');
  });

  it('assigns 00001 and 00002 and rejects a duplicate phone', async () => {
    const database = app.get(DatabaseService);
    try {
      const first = await database.query<{ id: string }>(
        `INSERT INTO passenger (phone, nickname)
         VALUES ($1, $2)
         RETURNING id`,
        ['13800000001', '13800000001'],
      );
      const second = await database.query<{ id: string }>(
        `INSERT INTO passenger (phone, nickname)
         VALUES ($1, $2)
         RETURNING id`,
        ['13800000002', '13800000002'],
      );

      expect(first.rows[0]?.id).toBe('00001');
      expect(second.rows[0]?.id).toBe('00002');
      await expect(
        database.query(
          `INSERT INTO passenger (phone, nickname)
           VALUES ($1, $2)`,
          ['13800000001', 'duplicate'],
        ),
      ).rejects.toThrow(/duplicate key value/);
    } finally {
      await database.query('DELETE FROM passenger').catch(() => undefined);
      await database
        .query(`SELECT setval('passenger_id_seq', 1, false)`)
        .catch(() => undefined);
    }
  });

  afterEach(async () => {
    await app.close();
  });
});
