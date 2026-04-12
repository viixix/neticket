import { NestFactory } from '@nestjs/core';
import { SeedingService } from '../seeding/seeding.service';
import { AppModule } from '../app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedingService = app.get(SeedingService);

  const args = process.argv.slice(2);
  const startDateStr = args[0];
  const endDateStr = args[1];

  if (!startDateStr || !endDateStr) {
    console.error('Usage: pnpm run seed <startDate> <endDate>');
    console.error('Example: pnpm run seed 2026-01-01 2026-01-31');
    await app.close();
    process.exit(1);
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error('Invalid date format. Use YYYY-MM-DD');
    await app.close();
    process.exit(1);
  }

  try {
    await seedingService.seed(startDate, endDate);
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await app.close();
  }
}

void bootstrap();
