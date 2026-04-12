import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
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

  const traceMiddleware = app.get(TraceMiddleware);
  app.use(traceMiddleware.use.bind(traceMiddleware));

  const traceService = app.get(TraceService);

  app.useLogger(getWinstonLogger('queue', traceService));

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  app.useGlobalFilters(app.get(GlobalExceptionFilter));

  // 배포 시 CORS를 nginx에서만 처리. 중복 시 'true, true' 등으로 깨짐.
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://neticket.vercel.app',
        'https://www.web10.site',
      ],
      credentials: true,
    });
  }

  const config = new DocumentBuilder()
    .setTitle('대기열 API 서버')
    .setDescription('티켓팅 시스템을 위한 대기열 관리 API 문서입니다.')
    .setVersion('1.0.0')
    .addCookieAuth('waiting-token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'waiting-token',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      withCredentials: true,
    },
  });

  await app.listen(Number(process.env.PORT ?? 3003));
}
void bootstrap();
