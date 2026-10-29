import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { DatabaseService } from './../src/database/database.service.js';
import {
  CLOCK,
  VERIFICATION_CODE_GENERATOR,
} from './../src/passengers/verification-codes.service.js';

describe('passenger login (e2e)', () => {
  let app: INestApplication<App>;
  let now = 1_700_000_000_000;
  let code = '654321';

  beforeEach(async () => {
    now = 1_700_000_000_000;
    code = '654321';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(VERIFICATION_CODE_GENERATOR)
      .useValue(() => code)
      .overrideProvider(CLOCK)
      .useValue(() => now)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    const database = app.get(DatabaseService);
    await database.query('DELETE FROM passenger');
    await database.query(`SELECT setval('passenger_id_seq', 1, false)`);
  });

  afterEach(async () => {
    await app.close();
  });

  it('logs a code without returning it, then signs in the first passenger as 00001', async () => {
    const log = vi.spyOn(Logger.prototype, 'log');
    const issued = await request(app.getHttpServer())
      .post('/passengers/verification-codes')
      .send({ phone: '13800000001' })
      .expect(201);

    expect(issued.body).toEqual({ accepted: true });
    expect(JSON.stringify(issued.body)).not.toContain('654321');
    expect(log).toHaveBeenCalledWith('手机号 13800000001 的验证码是 654321');

    const session = await request(app.getHttpServer())
      .post('/passengers/sessions')
      .send({ phone: '13800000001', code: '654321' })
      .expect(201);

    expect(session.body).toEqual({
      id: '00001',
      phone: '13800000001',
      nickname: '13800000001',
    });

    const again = await request(app.getHttpServer())
      .post('/passengers/verification-codes')
      .send({ phone: '13800000001' })
      .expect(201);
    expect(again.body).toEqual({ accepted: true });

    const samePassenger = await request(app.getHttpServer())
      .post('/passengers/sessions')
      .send({ phone: '13800000001', code: '654321' })
      .expect(201);
    expect(samePassenger.body.id).toBe('00001');
  });

  it('rejects a wrong, expired, or replaced code', async () => {
    await request(app.getHttpServer())
      .post('/passengers/sessions')
      .send({ phone: '13800000009', code: '654321' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('请先获取验证码');
      });

    await request(app.getHttpServer())
      .post('/passengers/verification-codes')
      .send({ phone: '13800000009' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/passengers/sessions')
      .send({ phone: '13800000009', code: '000000' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('验证码错误');
      });

    code = '222222';
    await request(app.getHttpServer())
      .post('/passengers/verification-codes')
      .send({ phone: '13800000009' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/passengers/sessions')
      .send({ phone: '13800000009', code: '654321' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('验证码错误');
      });

    now += 5 * 60 * 1000;
    await request(app.getHttpServer())
      .post('/passengers/sessions')
      .send({ phone: '13800000009', code: '222222' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('验证码已过期');
      });

    const database = app.get(DatabaseService);
    const rows = await database.query('SELECT id FROM passenger');
    expect(rows.rowCount).toBe(0);
  });

  it('asks for a phone number before sending a code', async () => {
    await request(app.getHttpServer())
      .post('/passengers/verification-codes')
      .send({ phone: '   ' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('请输入手机号');
      });
  });
});
