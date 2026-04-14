/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Captcha E2E Tests', () => {
  let app: INestApplication;
  let captchaId: string;
  let captchaCode: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // CORS 설정 (main.ts와 동일하게)
    app.enableCors({
      origin: 'http://localhost:3001',
      credentials: true,
      exposedHeaders: ['X-Captcha-Id'],
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /captcha', () => {
    it('should return captcha SVG image with captcha ID in header', async () => {
      const response = await request(app.getHttpServer())
        .get('/captcha')
        .expect(200)
        .expect('Content-Type', /image\/svg\+xml/);

      // X-Captcha-Id 헤더 확인
      expect(response.headers['x-captcha-id']).toBeDefined();
      expect(typeof response.headers['x-captcha-id']).toBe('string');

      captchaId = response.headers['x-captcha-id'];

      // SVG 이미지 확인 (response.body가 Buffer이므로 text로 변환)
      const svgText = response.body.toString();
      expect(svgText).toContain('<svg');
      expect(svgText).toContain('</svg>');
      expect(svgText).toContain('<text');

      // SVG에서 보안 문자 추출 (간단한 파싱)
      const textMatches = svgText.match(/<text[^>]*>([A-Z0-9])<\/text>/g);
      expect(textMatches).toBeDefined();
      expect(textMatches!.length).toBe(6); // 6자리

      // 보안 문자 코드 추출
      captchaCode = textMatches!
        .map((match) => match.match(/>([A-Z0-9])</)![1])
        .join('');

      console.log('Generated captcha code:', captchaCode);
    });
  });

  describe('POST /captcha/verify', () => {
    it('should verify correct captcha code', async () => {
      const response = await request(app.getHttpServer())
        .post('/captcha/verify')
        .send({
          captchaId,
          userInput: captchaCode,
        })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: '보안 문자 검증 성공',
      });
    });

    it('should reject incorrect captcha code', async () => {
      // 새로운 보안 문자 생성
      const captchaResponse = await request(app.getHttpServer())
        .get('/captcha')
        .expect(200);

      const newCaptchaId = captchaResponse.headers['x-captcha-id'];

      const response = await request(app.getHttpServer())
        .post('/captcha/verify')
        .send({
          captchaId: newCaptchaId,
          userInput: 'WRONG1',
        })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('보안 문자가 일치하지 않습니다.');
    });

    it('should reject missing captchaId or userInput', async () => {
      await request(app.getHttpServer())
        .post('/captcha/verify')
        .send({
          userInput: 'ABC123',
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/captcha/verify')
        .send({
          captchaId: 'some-id',
        })
        .expect(400);
    });

    it('should reject reused captcha after success (one-time use)', async () => {
      // 새로운 보안 문자 생성
      const captchaResponse = await request(app.getHttpServer())
        .get('/captcha')
        .expect(200);

      const newCaptchaId = captchaResponse.headers['x-captcha-id'];
      const svgText = captchaResponse.body.toString();
      const textMatches = svgText.match(/<text[^>]*>([A-Z0-9])<\/text>/g);
      const code = textMatches!
        .map((match: string) => match.match(/>([A-Z0-9])</)![1])
        .join('');

      // 첫 번째 검증 (성공)
      const firstResponse = await request(app.getHttpServer())
        .post('/captcha/verify')
        .send({
          captchaId: newCaptchaId,
          userInput: code,
        })
        .expect(201);

      expect(firstResponse.body.success).toBe(true);
      expect(firstResponse.body.message).toBe('보안 문자 검증 성공');

      // 두 번째 검증 (실패 - 이미 사용된 captchaId)
      const secondResponse = await request(app.getHttpServer())
        .post('/captcha/verify')
        .send({
          captchaId: newCaptchaId,
          userInput: code,
        })
        .expect(201);

      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.message).toBe(
        '보안 문자가 일치하지 않습니다.',
      );
    });

    it('should allow retry after incorrect attempt', async () => {
      // 새로운 보안 문자 생성
      const captchaResponse = await request(app.getHttpServer())
        .get('/captcha')
        .expect(200);

      const newCaptchaId = captchaResponse.headers['x-captcha-id'];
      const svgText = captchaResponse.body.toString();
      const textMatches = svgText.match(/<text[^>]*>([A-Z0-9])<\/text>/g);
      const code = textMatches!
        .map((match: string) => match.match(/>([A-Z0-9])</)![1])
        .join('');

      // 첫 번째 검증 (실패 - 잘못된 입력)
      const firstResponse = await request(app.getHttpServer())
        .post('/captcha/verify')
        .send({
          captchaId: newCaptchaId,
          userInput: 'WRONG1',
        })
        .expect(201);

      expect(firstResponse.body.success).toBe(false);
      expect(firstResponse.body.message).toBe('보안 문자가 일치하지 않습니다.');

      // 두 번째 검증 (성공 - 올바른 입력으로 재시도)
      const secondResponse = await request(app.getHttpServer())
        .post('/captcha/verify')
        .send({
          captchaId: newCaptchaId,
          userInput: code,
        })
        .expect(201);

      expect(secondResponse.body.success).toBe(true);
      expect(secondResponse.body.message).toBe('보안 문자 검증 성공');
    });
  });
});
