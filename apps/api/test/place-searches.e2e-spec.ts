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

const fengduStation = {
  placeId: 'B0FFSTATION',
  name: '丰都站',
  address: '重庆市丰都县',
  longitude: 107.73,
  latitude: 29.86,
};

const fengduGovernment = {
  placeId: 'B0FFGOVERN',
  name: '丰都县人民政府',
  address: '重庆市丰都县名山街道',
  longitude: 107.731,
  latitude: 29.863,
};

const fengduSquare = {
  placeId: 'B0FFSQUARE',
  name: '丰都八一广场',
  address: '重庆市丰都县雪玉路356号',
  longitude: 107.738,
  latitude: 29.862,
};

const fengduPort = {
  placeId: 'B0FFPORT',
  name: '丰都港',
  address: '重庆市丰都县滨江西路31号',
  longitude: 107.727,
  latitude: 29.869,
};

describe('passenger place searches (e2e)', () => {
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

  it('ranks a passenger places by how often they were chosen', async () => {
    const passenger = await signIn(app, '13800000021');

    const empty = await request(app.getHttpServer())
      .get(`/passengers/${passenger.id}/place-searches`)
      .expect(200);
    expect(empty.body).toEqual({ places: [] });

    await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/place-searches`)
      .send(fengduStation)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/place-searches`)
      .send(fengduGovernment)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/place-searches`)
      .send(fengduStation)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/place-searches`)
      .send(fengduSquare)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/place-searches`)
      .send(fengduPort)
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get(`/passengers/${passenger.id}/place-searches`)
      .expect(200);

    expect(listed.body.places).toHaveLength(3);
    expect(listed.body.places.map((place: { name: string; searchCount: number }) => ({
      name: place.name,
      searchCount: place.searchCount,
    }))).toEqual([
      { name: '丰都站', searchCount: 2 },
      { name: '丰都港', searchCount: 1 },
      { name: '丰都八一广场', searchCount: 1 },
    ]);
  });

  it('keeps each passenger recommendation list separate', async () => {
    const first = await signIn(app, '13800000021');
    const second = await signIn(app, '13800000022');

    await request(app.getHttpServer())
      .post(`/passengers/${first.id}/place-searches`)
      .send(fengduStation)
      .expect(201);

    const hidden = await request(app.getHttpServer())
      .get(`/passengers/${second.id}/place-searches`)
      .expect(200);
    expect(hidden.body).toEqual({ places: [] });
  });

  it('rejects an unknown passenger and an incomplete place', async () => {
    await request(app.getHttpServer())
      .get('/passengers/99999/place-searches')
      .expect(404)
      .expect((response) => {
        expect(response.body.message).toBe('乘客不存在');
      });

    const passenger = await signIn(app, '13800000021');
    await request(app.getHttpServer())
      .post(`/passengers/${passenger.id}/place-searches`)
      .send({ ...fengduStation, name: '  ' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('请提供地点名称');
      });
  });
});

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
