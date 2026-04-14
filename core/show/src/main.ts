import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  getWinstonLogger,
  GlobalExceptionFilter,
  TraceMiddleware,
  TraceService,
} from '@neticket/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const traceService = app.get(TraceService);

  app.useLogger(getWinstonLogger('show', traceService));

  const traceMiddleware = app.get<TraceMiddleware>(TraceMiddleware);
  app.use(traceMiddleware.use.bind(traceMiddleware));

  app.useGlobalFilters(app.get<GlobalExceptionFilter>(GlobalExceptionFilter));

  if (process.env.NODE_ENV !== 'production') {
    // CORS 설정
    app.enableCors({
      origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://www.web10.site',
        'https://neticket.vercel.app',
      ], // 프론트엔드 URL
      credentials: true,
    });
  }

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Show 서버')
    .setDescription('공연, 공연장 정보를 제공합니다.')
    .setVersion('0.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
