import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('공연 (Performances) API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/performances 요청 시', () => {
    describe('유효한 공연 정보가 주어지면', () => {
      let response: request.Response;

      beforeAll(async () => {
        const validBody = {
          performance_name: '테스트 공연',
          ticketing_date: '2000-01-01T00:00:00Z',
        };

        response = await request(app.getHttpServer() as App)
          .post('/api/performances')
          .send(validBody);
      });

      it('HTTP 상태 코드 201을 반환해야 한다', () => {
        expect(response.status).toBe(201);
      });

      it('응답 본문에 생성된 공연 ID가 포함되어야 한다', () => {
        const body = response.body as { id: number };
        expect(body.id).toBeDefined();
      });
    });

    describe('필수 정보가 누락되면', () => {
      let response: request.Response;

      beforeAll(async () => {
        const invalidBody = {
          ticketing_date: new Date().toISOString(),
        };

        response = await request(app.getHttpServer() as App)
          .post('/api/performances')
          .send(invalidBody);
      });

      it('HTTP 상태 코드 400을 반환해야 한다', () => {
        expect(response.status).toBe(400);
      });
    });

    describe('ticketing_date 형식이 UTC가 아니면 (Z 없음)', () => {
      let response: request.Response;

      beforeAll(async () => {
        const invalidBody = {
          performance_name: 'UTC 테스트 공연',
          ticketing_date: '2026-01-01T13:00:00', // Z 없음
        };

        response = await request(app.getHttpServer() as App)
          .post('/api/performances')
          .send(invalidBody);
      });

      it('HTTP 상태 코드 400을 반환해야 한다', () => {
        expect(response.status).toBe(400);
      });
    });
  });

  describe('GET /api/performances 요청 시', () => {
    let pastPerformanceId: number;
    let futurePerformanceId: number;
    let farFuturePerformanceId: number;

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(now);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    beforeAll(async () => {
      const createPerformance = async (name: string, date: Date) => {
        const res = await request(app.getHttpServer() as App)
          .post('/api/performances')
          .send({
            performance_name: name,
            ticketing_date: date.toISOString(),
          });
        return (res.body as { id: number }).id;
      };

      pastPerformanceId = await createPerformance('과거 공연', yesterday);
      futurePerformanceId = await createPerformance('미래 공연', tomorrow);
      farFuturePerformanceId = await createPerformance(
        '먼 미래 공연',
        dayAfterTomorrow,
      );
    });

    describe('ticketing_after 파라미터를 생략하면 (기본값 테스트)', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App).get(
          '/api/performances',
        );
      });

      it('HTTP 상태 코드 200을 반환해야 한다', () => {
        expect(response.status).toBe(200);
      });

      it('과거 공연은 제외되고 미래 공연만 조회되어야 한다', () => {
        const body = response.body as {
          performances: { performance_id: number }[];
        };
        const ids = body.performances.map((p) => p.performance_id);

        expect(ids).not.toContain(pastPerformanceId);
        expect(ids).toContain(futurePerformanceId);
        expect(ids).toContain(farFuturePerformanceId);
      });
    });

    describe('ticketing_after 파라미터로 오늘 날짜를 전달하면', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App)
          .get('/api/performances')
          .query({ ticketing_after: now.toISOString() });
      });

      it('HTTP 상태 코드 200을 반환해야 한다', () => {
        expect(response.status).toBe(200);
      });

      it('과거 공연은 제외되고 미래 공연만 조회되어야 한다', () => {
        const body = response.body as {
          performances: { performance_id: number }[];
        };
        const ids = body.performances.map((p) => p.performance_id);

        expect(ids).not.toContain(pastPerformanceId);
        expect(ids).toContain(futurePerformanceId);
        expect(ids).toContain(farFuturePerformanceId);
      });
    });

    describe('limit 파라미터로 1을 전달하면', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App)
          .get('/api/performances')
          .query({
            ticketing_after: now.toISOString(),
            limit: 1,
          });
      });

      it('결과가 1개만 반환되어야 한다', () => {
        const body = response.body as { performances: any[] };
        expect(body.performances).toHaveLength(1);
      });

      it('티켓팅 날짜가 가장 빠른 미래 공연이 반환되어야 한다 (오름차순)', () => {
        const body = response.body as {
          performances: { performance_id: number }[];
        };
        expect(body.performances[0].performance_id).toBe(futurePerformanceId);
      });
    });

    describe('limit 기본값 검증을 위해 미래 공연을 15개 추가하면', () => {
      beforeAll(async () => {
        for (let i = 0; i < 15; i++) {
          await request(app.getHttpServer() as App)
            .post('/api/performances')
            .send({
              performance_name: `Limit Test Performance ${i}`,
              ticketing_date: tomorrow.toISOString(),
            });
        }
      });

      describe('limit 파라미터를 생략했을 때', () => {
        let response: request.Response;

        beforeAll(async () => {
          response = await request(app.getHttpServer() as App)
            .get('/api/performances')
            .query({ ticketing_after: now.toISOString() });
        });

        it('기본값인 10개의 공연이 반환되어야 한다', () => {
          const body = response.body as { performances: any[] };
          expect(body.performances).toHaveLength(10);
        });
      });

      describe('limit 파라미터로 15를 전달하면', () => {
        let response: request.Response;

        beforeAll(async () => {
          response = await request(app.getHttpServer() as App)
            .get('/api/performances')
            .query({
              ticketing_after: now.toISOString(),
              limit: 15,
            });
        });

        it('15개의 공연이 반환되어야 한다', () => {
          const body = response.body as { performances: any[] };
          expect(body.performances).toHaveLength(15);
        });
      });
    });

    describe('ticketing_after 형식이 UTC가 아니면 (Z 없음)', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App)
          .get('/api/performances')
          .query({ ticketing_after: '2026-01-01T00:00:00' }); // Z 없음
      });

      it('HTTP 상태 코드 400을 반환해야 한다', () => {
        expect(response.status).toBe(400);
      });
    });
  });

  describe('공연 회차 (Sessions) API', () => {
    let performanceId: number;
    let venueId: number;

    beforeAll(async () => {
      const venueRes = await request(app.getHttpServer() as App)
        .post('/api/venues')
        .send({ venue_name: '회차 테스트 공연장' });
      venueId = (venueRes.body as { id: number }).id;

      const perfRes = await request(app.getHttpServer() as App)
        .post('/api/performances')
        .send({
          performance_name: '회차 테스트 공연',
          ticketing_date: new Date().toISOString(),
        });
      performanceId = (perfRes.body as { id: number }).id;
    });

    describe('POST /api/performances/:id/sessions 요청 시', () => {
      describe('유효한 회차 정보가 주어지면', () => {
        let response: request.Response;

        beforeAll(async () => {
          response = await request(app.getHttpServer() as App)
            .post(`/api/performances/${performanceId}/sessions`)
            .send({
              sessionDate: new Date().toISOString(),
              venue_id: venueId,
            });
        });

        it('HTTP 상태 코드 201을 반환해야 한다', () => {
          expect(response.status).toBe(201);
        });

        it('응답 본문에 생성된 회차 ID가 포함되어야 한다', () => {
          const body = response.body as { id: number };
          expect(body.id).toBeDefined();
        });
      });
    });

    describe('GET /api/performances/:id/sessions 요청 시', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App).get(
          `/api/performances/${performanceId}/sessions`,
        );
      });

      it('HTTP 상태 코드 200을 반환해야 한다', () => {
        expect(response.status).toBe(200);
      });

      it('회차 목록이 배열 형태로 반환되어야 한다', () => {
        expect(Array.isArray(response.body)).toBe(true);
      });

      it('회차 정보에 venueId가 포함되어야 한다', () => {
        const body = response.body as { venueId: number }[];
        expect(body[0].venueId).toBe(venueId);
      });
    });
  });

  describe('공연 등급 (Grades) API', () => {
    let sessionId: number;

    beforeAll(async () => {
      const venueRes = await request(app.getHttpServer() as App)
        .post('/api/venues')
        .send({ venue_name: '등급 테스트 공연장' });
      const venueId = (venueRes.body as { id: number }).id;

      const perfRes = await request(app.getHttpServer() as App)
        .post('/api/performances')
        .send({
          performance_name: '등급 테스트 공연',
          ticketing_date: new Date().toISOString(),
        });
      const performanceId = (perfRes.body as { id: number }).id;

      const sessionRes = await request(app.getHttpServer() as App)
        .post(`/api/performances/${performanceId}/sessions`)
        .send({
          sessionDate: new Date().toISOString(),
          venue_id: venueId,
        });
      sessionId = (sessionRes.body as { id: number }).id;
    });

    describe('POST /api/sessions/:sessionId/grades 요청 시', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App)
          .post(`/api/sessions/${sessionId}/grades`)
          .send([
            { name: 'VIP', price: 150000 },
            { name: 'R', price: 100000 },
          ]);
      });

      it('HTTP 상태 코드 201을 반환해야 한다', () => {
        expect(response.status).toBe(201);
      });
    });

    describe('GET /api/sessions/:sessionId/grades 요청 시', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App).get(
          `/api/sessions/${sessionId}/grades`,
        );
      });

      it('HTTP 상태 코드 200을 반환해야 한다', () => {
        expect(response.status).toBe(200);
      });

      it('생성한 등급 목록이 포함되어야 한다', () => {
        const body = response.body as { name: string }[];
        const names = body.map((g) => g.name);
        expect(names).toContain('VIP');
        expect(names).toContain('R');
      });
    });
  });

  describe('구역-등급 매핑 (BlockGrades) API', () => {
    let sessionId: number;
    let gradeId: number;
    let blockId1: number;

    beforeAll(async () => {
      const venueRes = await request(app.getHttpServer() as App)
        .post('/api/venues')
        .send({ venue_name: '구역 매핑 테스트 공연장' });
      const venueId = (venueRes.body as { id: number }).id;

      // 구역 생성
      await request(app.getHttpServer() as App)
        .post(`/api/venues/${venueId}/blocks`)
        .send({
          blocks: [
            { blockDataName: 'A-1', rowSize: 10, colSize: 10 },
            { blockDataName: 'A-2', rowSize: 10, colSize: 10 },
          ],
        });

      const venueInfo = await request(app.getHttpServer() as App).get(
        `/api/venues/${venueId}`,
      );
      blockId1 = (venueInfo.body as { blocks: { id: number }[] }).blocks[0].id;

      const perfRes = await request(app.getHttpServer() as App)
        .post('/api/performances')
        .send({
          performance_name: '구역 매핑 테스트 공연',
          ticketing_date: new Date().toISOString(),
        });
      const performanceId = (perfRes.body as { id: number }).id;

      const sessionRes = await request(app.getHttpServer() as App)
        .post(`/api/performances/${performanceId}/sessions`)
        .send({
          sessionDate: new Date().toISOString(),
          venue_id: venueId,
        });
      sessionId = (sessionRes.body as { id: number }).id;

      // 등급 생성
      await request(app.getHttpServer() as App)
        .post(`/api/sessions/${sessionId}/grades`)
        .send([{ name: 'VIP', price: 150000 }]);

      const gradeRes = await request(app.getHttpServer() as App).get(
        `/api/sessions/${sessionId}/grades`,
      );
      gradeId = (gradeRes.body as { id: number }[])[0].id;
    });

    describe('POST /api/sessions/:sessionId/block-grades 요청 시', () => {
      describe('유효한 매핑 정보가 주어지면', () => {
        let response: request.Response;

        beforeAll(async () => {
          response = await request(app.getHttpServer() as App)
            .post(`/api/sessions/${sessionId}/block-grades`)
            .send([{ gradeId: gradeId, blockIds: [blockId1] }]);
        });

        it('HTTP 상태 코드 201을 반환해야 한다', () => {
          expect(response.status).toBe(201);
        });
      });

      describe('이미 할당된 구역을 다시 할당하려고 하면', () => {
        let response: request.Response;

        beforeAll(async () => {
          response = await request(app.getHttpServer() as App)
            .post(`/api/sessions/${sessionId}/block-grades`)
            .send([{ gradeId: gradeId, blockIds: [blockId1] }]);
        });

        it('HTTP 상태 코드 400을 반환해야 한다', () => {
          expect(response.status).toBe(400);
        });
      });
    });

    describe('GET /api/sessions/:sessionId/block-grades 요청 시', () => {
      let response: request.Response;

      beforeAll(async () => {
        response = await request(app.getHttpServer() as App).get(
          `/api/sessions/${sessionId}/block-grades`,
        );
      });

      it('HTTP 상태 코드 200을 반환해야 한다', () => {
        expect(response.status).toBe(200);
      });

      it('할당된 구역 매핑 정보가 포함되어야 한다', () => {
        const body = response.body as {
          blockId: number;
          grade: { id: number };
        }[];
        const mapping = body.find((m) => m.blockId === blockId1);
        expect(mapping).toBeDefined();
        expect(mapping?.grade.id).toBe(gradeId);
      });
    });
  });
});
