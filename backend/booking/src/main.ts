import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  getWinstonLogger,
  GlobalExceptionFilter,
  TraceMiddleware,
  TraceService,
} from '@neticket/shared-nestjs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const traceService = app.get(TraceService);

  app.useLogger(getWinstonLogger('booking', traceService));

  const traceMiddleware = app.get(TraceMiddleware);
  app.use(traceMiddleware.use.bind(traceMiddleware));

  app.useGlobalFilters(app.get(GlobalExceptionFilter));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('티켓팅 API Server')
    .setDescription('티켓 예약 및 좌석 조회 기능을 제공합니다.')
    .setVersion('0.1')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
        description: 'JWT Authorization header using the Bearer scheme',
      },
      'access-token',
    )
    .addSecurityRequirements('access-token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  if (process.env.NODE_ENV !== 'production') {
    // CORS 설정
    app.enableCors({
      origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://neticket.vercel.app',
        'https://www.web10.site',
      ], // 프론트엔드 URL
      credentials: true,
      exposedHeaders: ['X-Captcha-Id'], // 커스텀 헤더 노출
    });
  }

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
