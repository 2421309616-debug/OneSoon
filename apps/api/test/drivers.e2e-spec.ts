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

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const profile = {
  name: '王师傅',
  idNumber: '500230199001011234',
  vehicleModel: '丰田卡罗拉',
  plate: '渝F12345',
  photo: pixel,
  driverLicense: pixel,
  vehicleLicense: pixel,
};

describe('driver login (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(VERIFICATION_CODE_GENERATOR)
      .useValue(() => '654321')
      .overrideProvider(CLOCK)
      .useValue(() => 1_700_000_000_000)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    const database = app.get(DatabaseService);
    await database.query('DELETE FROM driver');
    await database.query(`SELECT setval('driver_id_seq', 1, false)`);
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a driver on the first login and returns the same driver next time', async () => {
    const phone = '13800000041';
    await request(app.getHttpServer())
      .post('/drivers/verification-codes')
      .send({ phone })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/drivers/sessions')
      .send({ phone, code: '654321' })
      .expect(201);
    expect(created.body).toEqual({
      id: '00001',
      phone,
      displayName: phone,
      profileComplete: false,
    });

    const stored = await app.get(DatabaseService).query<{
      name: string | null;
      vehicle_model: string | null;
      plate: string | null;
      photo: string | null;
      id_card: string | null;
      driver_license: string | null;
    }>(
      `SELECT name, vehicle_model, plate, photo, id_card, driver_license
       FROM driver WHERE id = $1`,
      [created.body.id],
    );
    expect(stored.rows[0]).toEqual({
      name: null,
      vehicle_model: null,
      plate: null,
      photo: null,
      id_card: null,
      driver_license: null,
    });

    await request(app.getHttpServer())
      .post('/drivers/verification-codes')
      .send({ phone })
      .expect(201);
    const again = await request(app.getHttpServer())
      .post('/drivers/sessions')
      .send({ phone, code: '654321' })
      .expect(201);
    expect(again.body.id).toBe(created.body.id);
  });

  it('stores the certification profile and then lets the driver into the app', async () => {
    const phone = '13800000043';
    const created = await signIn(app, phone);
    expect(created.profileComplete).toBe(false);

    const completed = await request(app.getHttpServer())
      .post(`/drivers/${created.id}/profile`)
      .send({
        name: '王师傅',
        idNumber: '500230199001011234',
        vehicleModel: '丰田卡罗拉',
        plate: '渝F12345',
        photo: pixel,
        driverLicense: pixel,
        vehicleLicense: pixel,
      })
      .expect(201);
    expect(completed.body).toEqual({
      id: created.id,
      phone,
      displayName: '王师傅',
      profileComplete: true,
    });

    const again = await signIn(app, phone);
    expect(again).toEqual(completed.body);
  });

  it('rejects an incomplete profile and a repeated id number', async () => {
    const first = await signIn(app, '13800000043');
    await request(app.getHttpServer())
      .post(`/drivers/${first.id}/profile`)
      .send({ name: ' ' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('请填写姓名');
      });

    await request(app.getHttpServer())
      .post(`/drivers/${first.id}/profile`)
      .send({
        name: '王师傅',
        idNumber: '123',
        vehicleModel: '丰田卡罗拉',
        plate: '渝F12345',
        photo: pixel,
        driverLicense: pixel,
        vehicleLicense: pixel,
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('身份证号不正确');
      });

    await request(app.getHttpServer())
      .post(`/drivers/${first.id}/profile`)
      .send(profile)
      .expect(201);
    const second = await signIn(app, '13800000044');
    await request(app.getHttpServer())
      .post(`/drivers/${second.id}/profile`)
      .send(profile)
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('该身份证号已登记');
      });
  });

  it('rejects a missing or wrong code', async () => {
    const phone = '13800000042';
    await request(app.getHttpServer())
      .post('/drivers/sessions')
      .send({ phone, code: '654321' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('请先获取验证码');
      });

    await request(app.getHttpServer())
      .post('/drivers/verification-codes')
      .send({ phone })
      .expect(201);
    await request(app.getHttpServer())
      .post('/drivers/sessions')
      .send({ phone, code: '000000' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('验证码错误');
      });
  });
});

async function signIn(app: INestApplication<App>, phone: string) {
  await request(app.getHttpServer())
    .post('/drivers/verification-codes')
    .send({ phone })
    .expect(201);
  const session = await request(app.getHttpServer())
    .post('/drivers/sessions')
    .send({ phone, code: '654321' })
    .expect(201);
  return session.body as { id: string; phone: string; displayName: string; profileComplete: boolean };
}
