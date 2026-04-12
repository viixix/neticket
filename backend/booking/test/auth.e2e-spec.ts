import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { jwtConfig } from '@neticket/shared-nestjs';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';

// 테스트용 컨트롤러
@Controller('test')
class TestController {
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  getProtected() {
    return { message: 'success' };
  }
}

describe('JWT Auth Guard (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        AuthModule,
      ],
      controllers: [TestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /test/protected', () => {
    it('should return 401 when no token is provided', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return request(app.getHttpServer())
        .get('/test/protected')
        .expect(401)
        .expect((res) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(res.body.message).toBe('Active token is required');
        });
    });

    it('should return 401 when invalid token is provided', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
        .expect((res) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(res.body.message).toBe('Invalid active token');
        });
    });

    it('should return 401 when token type is not TICKETING', async () => {
      const invalidToken = await jwtService.signAsync({
        sub: 'user123',
        type: 'INVALID_TYPE',
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401)
        .expect((res) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(res.body.message).toBe('Invalid token type');
        });
    });

    it('should return 401 when token is expired', async () => {
      const expiredToken = await jwtService.signAsync(
        {
          sub: 'user123',
          type: 'TICKETING',
        },
        { expiresIn: '0s' }, // 즉시 만료
      );

      // 토큰이 만료될 시간을 주기 위해 약간 대기
      await new Promise((resolve) => setTimeout(resolve, 100));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401)
        .expect((res) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(res.body.message).toBe('Active token has expired');
        });
    });

    it('should return 401 when userId (sub) is missing', async () => {
      const invalidToken = await jwtService.signAsync({
        type: 'TICKETING',
        // sub 누락
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401)
        .expect((res) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(res.body.message).toBe('Invalid token payload');
        });
    });

    it('should return 200 when valid token is provided', async () => {
      const validToken = await jwtService.signAsync({
        sub: 'user123',
        type: 'TICKETING',
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .expect({ message: 'success' });
    });

    // Cookie 파싱을 위해서는 cookie-parser 미들웨어가 필요합니다
    // 실제 애플리케이션에서는 main.ts에 추가 필요
    it.skip('should extract token from cookie', async () => {
      const validToken = await jwtService.signAsync({
        sub: 'user123',
        type: 'TICKETING',
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return request(app.getHttpServer())
        .get('/test/protected')
        .set('Cookie', `activeToken=${validToken}`)
        .expect(200)
        .expect({ message: 'success' });
    });
  });
});
