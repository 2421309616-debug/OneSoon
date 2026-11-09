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

const trip = {
  pickup: { name: '丰都站', longitude: 107.73, latitude: 29.86 },
  destination: { name: '丰都八一广场', longitude: 107.738, latitude: 29.862 },
  distanceMeters: 5700,
  durationSeconds: 660,
};

describe('passenger trip orders (e2e)', () => {
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
    await database.query('DELETE FROM passenger');
    await database.query(`SELECT setval('passenger_id_seq', 1, false)`);
  });

  afterEach(async () => {
    await app.close();
  });

  it('places a waiting order at the fixed fare', async () => {
    const passenger = await signIn(app, '13800000031');

    const none = await request(app.getHttpServer())
      .get(`/passengers/${passenger.id}/orders/current`)
      .expect(200);
    expect(none.body).toEqual({ order: null });

    const placed = await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders`)
      .send({ ...trip, fareCents: 1 })
      .expect(201);
    expect(placed.body).toMatchObject({
      status: 'waiting',
      pickup: trip.pickup,
      destination: trip.destination,
      distanceMeters: 5700,
      durationSeconds: 660,
      fareCents: 1000,
    });

    const current = await request(app.getHttpServer())
      .get(`/passengers/${passenger.id}/orders/current`)
      .expect(200);
    expect(current.body.order.id).toBe(placed.body.id);
  });

  it('returns the waiting order instead of placing a second one', async () => {
    const passenger = await signIn(app, '13800000031');
    const first = await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders`)
      .send(trip)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders`)
      .send({ ...trip, destination: { name: '丰都港', longitude: 107.727, latitude: 29.869 } })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.destination.name).toBe('丰都八一广场');
  });

  it('cancels an order so the passenger can place a new one', async () => {
    const passenger = await signIn(app, '13800000031');
    const placed = await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders`)
      .send(trip)
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders/${placed.body.id}/cancel`)
      .expect(201);
    expect(cancelled.body.status).toBe('cancelled');

    const none = await request(app.getHttpServer())
      .get(`/passengers/${passenger.id}/orders/current`)
      .expect(200);
    expect(none.body).toEqual({ order: null });

    const next = await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders`)
      .send(trip)
      .expect(201);
    expect(next.body.id).not.toBe(placed.body.id);
  });

  it('keeps one passenger from cancelling another passenger order', async () => {
    const owner = await signIn(app, '13800000031');
    const other = await signIn(app, '13800000032');
    const placed = await request(app.getHttpServer())
      .post(`/passengers/${owner.id}/orders`)
      .send(trip)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/passengers/${other.id}/orders/${placed.body.id}/cancel`)
      .expect(404)
      .expect((response) => {
        expect(response.body.message).toBe('订单不存在');
      });
  });

  it('lets one driver accept the waiting order and shows that driver to the passenger', async () => {
    const passenger = await signIn(app, '13800000031');
    await app.get(DatabaseService).query(
      `UPDATE passenger SET nickname = $2 WHERE id = $1`,
      [passenger.id, '林女士'],
    );
    const placed = await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders`)
      .send(trip)
      .expect(201);

    const driver = await signInDriver(app, '13800000081');
    await app.get(DatabaseService).query(
      `UPDATE driver SET name = $2, vehicle_model = $3, plate = $4 WHERE id = $1`,
      [driver.id, '陈立', '跑车', '渝A38291'],
    );

    const listed = await request(app.getHttpServer())
      .get(`/drivers/${driver.id}/orders/waiting`)
      .expect(200);
    expect(listed.body.orders).toEqual([
      expect.objectContaining({
        id: placed.body.id,
        status: 'waiting',
        passengerName: '林女士',
        pickup: trip.pickup,
        destination: trip.destination,
        fareCents: 1000,
      }),
    ]);
    expect(JSON.stringify(listed.body)).not.toContain('13800000031');

    const accepted = await request(app.getHttpServer())
      .post(`/drivers/${driver.id}/orders/${placed.body.id}/accept`)
      .expect(201);
    expect(accepted.body).toMatchObject({
      id: placed.body.id,
      status: 'accepted',
      passengerName: '林女士',
      driver: {
        name: '陈立',
        vehicleModel: '跑车',
        plate: '渝A38291',
        photoUrl: null,
        vehicleImageUrl: expect.stringMatching(/^\/vehicle-options\/1\/image\?v=/),
      },
    });

    const current = await request(app.getHttpServer())
      .get(`/passengers/${passenger.id}/orders/current`)
      .expect(200);
    expect(current.body.order).toMatchObject({
      id: placed.body.id,
      status: 'accepted',
      driver: {
        name: '陈立',
        vehicleModel: '跑车',
        plate: '渝A38291',
        photoUrl: null,
        vehicleImageUrl: expect.stringMatching(/^\/vehicle-options\/1\/image\?v=/),
      },
    });

    const waiting = await request(app.getHttpServer())
      .get(`/drivers/${driver.id}/orders/waiting`)
      .expect(200);
    expect(waiting.body.orders).toEqual([]);

    const held = await request(app.getHttpServer())
      .get(`/drivers/${driver.id}/orders/current`)
      .expect(200);
    expect(held.body.order.id).toBe(placed.body.id);
    expect(held.body.order.status).toBe('accepted');
  });

  it('keeps a second driver from taking an accepted order', async () => {
    const passenger = await signIn(app, '13800000031');
    const otherPassenger = await signIn(app, '13800000032');
    const placed = await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders`)
      .send(trip)
      .expect(201);
    const other = await request(app.getHttpServer())
      .post(`/passengers/${otherPassenger.id}/orders`)
      .send(trip)
      .expect(201);
    const first = await signInDriver(app, '13800000081');
    const second = await signInDriver(app, '13800000082');

    await request(app.getHttpServer())
      .post(`/drivers/${first.id}/orders/${placed.body.id}/accept`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/drivers/${second.id}/orders/${placed.body.id}/accept`)
      .expect(409)
      .expect((response) => {
        expect(response.body.message).toBe('订单已被接走');
      });

    await request(app.getHttpServer())
      .post(`/drivers/${first.id}/orders/${other.body.id}/accept`)
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('请先完成当前订单');
      });

    const cancelled = await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders/${placed.body.id}/cancel`)
      .expect(201);
    expect(cancelled.body.status).toBe('cancelled');

    const none = await request(app.getHttpServer())
      .get(`/passengers/${passenger.id}/orders/current`)
      .expect(200);
    expect(none.body).toEqual({ order: null });

    const released = await request(app.getHttpServer())
      .get(`/drivers/${first.id}/orders/current`)
      .expect(200);
    expect(released.body).toEqual({ order: null });

    await request(app.getHttpServer())
      .post(`/drivers/${first.id}/orders/${other.body.id}/accept`)
      .expect(201);

    const again = await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders`)
      .send(trip)
      .expect(201);
    expect(again.body.id).not.toBe(placed.body.id);
    expect(again.body.status).toBe('waiting');
  });

  it('rejects an unknown passenger and an incomplete trip', async () => {
    await request(app.getHttpServer())
      .post('/passengers/99999/orders')
      .send(trip)
      .expect(404)
      .expect((response) => {
        expect(response.body.message).toBe('乘客不存在');
      });

    const passenger = await signIn(app, '13800000031');
    await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders`)
      .send({ ...trip, destination: { ...trip.destination, name: ' ' } })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('请提供目的地名称');
      });
    await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/orders`)
      .send({ ...trip, distanceMeters: 0 })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('路线距离不正确');
      });
  });
});

async function signInDriver(app: INestApplication<App>, phone: string) {
  await request(app.getHttpServer())
    .post('/drivers/verification-codes')
    .send({ phone })
    .expect(201);
  const session = await request(app.getHttpServer())
    .post('/drivers/sessions')
    .send({ phone, code: '654321' })
    .expect(201);
  return session.body as { id: string };
}

async function signIn(app: INestApplication<App>, phone: string) {
  await request(app.getHttpServer())
    .post('/passengers/verification-codes')
    .send({ phone })
    .expect(201);
  const session = await request(app.getHttpServer())
    .post('/passengers/sessions')
    .send({ phone, code: '654321' })
    .expect(201);
  return session.body as { id: string };
}
