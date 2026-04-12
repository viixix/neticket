import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { KopisScheduler } from '../kopis/kopis.scheduler';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const kopisScheduler = app.get(KopisScheduler);

  try {
    await kopisScheduler.syncPerformances();
  } catch (error) {
    console.error('KOPIS sync failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void bootstrap();
