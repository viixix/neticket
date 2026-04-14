import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

describe('공연장 (Venues) API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    // E2E 테스트 환경에서 정적 파일 서빙 강제 연결
    (app as NestExpressApplication).useStaticAssets(
      join(process.cwd(), 'public'),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/venues 요청 시', () => {
    describe('유효한 공연장 이름이 주어지면', () => {
      const validBody = { venue_name: '올림픽 체조경기장' };
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App)
          .post('/api/venues')
          .send(validBody);
      });

      it('HTTP 상태 코드 201을 반환해야 한다', () => {
        expect(response.status).toBe(201);
      });

      it('응답 본문에 생성된 ID가 포함되어야 한다', () => {
        const body = response.body as { id: number };
        expect(body.id).toBeDefined();
      });
    });

    describe('공연장 이름(venue_name)이 누락되면', () => {
      const invalidBody = {};
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App)
          .post('/api/venues')
          .send(invalidBody);
      });

      it('HTTP 상태 코드 400을 반환해야 한다', () => {
        expect(response.status).toBe(400);
      });
    });
  });

  describe('GET /api/venues 요청 시', () => {
    describe('저장된 공연장이 있다면', () => {
      beforeAll(async () => {
        await request(app.getHttpServer() as App)
          .post('/api/venues')
          .send({ venue_name: '인천 남동 체육관' });

        await request(app.getHttpServer() as App)
          .post('/api/venues')
          .send({ venue_name: '올림픽 체조경기장' });
      });

      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App).get('/api/venues');
      });

      it('HTTP 상태 코드 200을 반환해야 한다', () => {
        expect(response.status).toBe(200);
      });

      it('응답 본문에 공연장 목록이 포함되어야 한다', () => {
        const body = response.body as {
          venues: {
            id: number;
            venue_name: string;
            block_map_url: string | null;
          }[];
        };
        expect(body.venues).toBeDefined();
        expect(Array.isArray(body.venues)).toBe(true);
        expect(body.venues.length).toBeGreaterThanOrEqual(2);
      });

      it('생성된 공연장 이름들이 목록에 존재해야 한다', () => {
        const body = response.body as {
          venues: { id: number; venue_name: string }[];
        };
        const venueNames = body.venues.map((v) => v.venue_name);
        expect(venueNames).toContain('인천 남동 체육관');
        expect(venueNames).toContain('올림픽 체조경기장');
      });
    });
  });

  describe('POST /api/venues/:id/blocks 요청 시', () => {
    let venueId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/api/venues')
        .send({ venue_name: '구역 생성 테스트용 공연장' });
      venueId = (res.body as { id: number }).id;
    });

    describe('유효한 구역 목록이 주어지면', () => {
      let response: request.Response;
      const validBlocks = {
        blocks: [
          { blockDataName: 'A-1', rowSize: 10, colSize: 10 },
          { blockDataName: 'B-1', rowSize: 20, colSize: 20 },
        ],
      };

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App)
          .post(`/api/venues/${venueId}/blocks`)
          .send(validBlocks);
      });

      it('HTTP 상태 코드 201을 반환해야 한다', () => {
        expect(response.status).toBe(201);
      });
    });

    describe('중복된 구역 이름이 포함되어 있으면', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App)
          .post(`/api/venues/${venueId}/blocks`)
          .send({
            blocks: [{ blockDataName: 'A-1', rowSize: 10, colSize: 10 }],
          });
      });

      it('HTTP 상태 코드 400을 반환해야 한다', () => {
        expect(response.status).toBe(400);
      });

      it('에러 메시지에 중복된 이름이 포함되어야 한다', () => {
        const body = response.body as { message: string };
        expect(body.message).toContain('중복된 블록 이름이 존재합니다 : A-1');
      });
    });

    describe('존재하지 않는 공연장 ID가 주어지면', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App)
          .post('/api/venues/9999/blocks')
          .send({
            blocks: [{ blockDataName: 'A-1', rowSize: 10, colSize: 10 }],
          });
      });

      it('HTTP 상태 코드 400을 반환해야 한다', () => {
        expect(response.status).toBe(400);
      });
    });
  });

  describe('GET /api/venues/:id 요청 시', () => {
    let createdVenueId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/api/venues')
        .send({
          venue_name: '인천 남동 체육관',
          block_map_url: '/static/svg/incheon_namdong_gymnasium.svg',
        });
      createdVenueId = (res.body as { id: number }).id;

      await request(app.getHttpServer() as App)
        .post(`/api/venues/${createdVenueId}/blocks`)
        .send({
          blocks: [
            {
              blockDataName: 'A-1',
              rowSize: 10,
              colSize: 15,
            },
            {
              blockDataName: 'B-1',
              rowSize: 12,
              colSize: 20,
            },
          ],
        });
    });

    describe('존재하는 공연장 ID가 주어지면', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App).get(
          `/api/venues/${createdVenueId}`,
        );
      });

      it('HTTP 상태 코드 200을 반환해야 한다', () => {
        expect(response.status).toBe(200);
      });

      it('응답 본문에 공연장 상세 정보가 포함되어야 한다', () => {
        const body = response.body as {
          id: number;
          venueName: string;
          blockMapUrl: string;
          blocks: {
            id: number;
            blockDataName: string;
            rowSize: number;
            colSize: number;
          }[];
        };
        expect(body.id).toBe(createdVenueId);
        expect(body.venueName).toBe('인천 남동 체육관');
        expect(body.blockMapUrl).toBe(
          '/static/svg/incheon_namdong_gymnasium.svg',
        );
        expect(Array.isArray(body.blocks)).toBe(true);
      });

      it('구역(Block) 정보가 올바르게 반환되어야 한다', () => {
        const body = response.body as {
          blocks: {
            id: number;
            blockDataName: string;
            rowSize: number;
            colSize: number;
          }[];
        };
        expect(body.blocks.length).toBe(2);

        const blockA1 = body.blocks.find((b) => b.blockDataName === 'A-1');
        expect(blockA1).toBeDefined();
        if (blockA1) {
          expect(blockA1.rowSize).toBe(10);
          expect(blockA1.colSize).toBe(15);
        }

        const blockB1 = body.blocks.find((b) => b.blockDataName === 'B-1');
        expect(blockB1).toBeDefined();
        if (blockB1) {
          expect(blockB1.rowSize).toBe(12);
          expect(blockB1.colSize).toBe(20);
        }
      });
    });

    describe('존재하지 않는 공연장 ID가 주어지면', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App).get(
          '/api/venues/99999',
        );
      });

      it('HTTP 상태 코드 200을 반환해야 한다', () => {
        expect(response.status).toBe(200);
      });

      it('빈 객체를 반환해야 한다', () => {
        expect(response.body).toEqual({});
      });
    });
  });

  describe('정적 파일 서빙 (Static Assets)', () => {
    describe('존재하는 SVG 파일 요청 시', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App).get(
          '/static/svg/incheon_namdong_gymnasium.svg',
        );
      });

      it('HTTP 상태 코드 200을 반환해야 한다', () => {
        expect(response.status).toBe(200);
      });

      it('Content-Type이 image/svg+xml이어야 한다', () => {
        expect(response.headers['content-type']).toMatch(/^image\/svg\+xml/);
      });
    });
  });
});
