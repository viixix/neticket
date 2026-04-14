import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { VenuesModule } from './venues/venues.module';
import { PerformancesModule } from './performances/performances.module';
import { SeedingModule } from './seeding/seeding.module';
import { KopisModule } from './kopis/kopis.module';
import { ChatModule } from './chat/chat.module';
import { UserModule } from './user/user.module';
import { Venue } from './venues/entities/venue.entity';
import { Block } from './venues/entities/block.entity';
import { Performance } from './performances/entities/performance.entity';
import { Session } from './performances/entities/session.entity';
import { Grade } from './performances/entities/grade.entity';
import { BlockGrade } from './performances/entities/block-grade.entity';
import { ChatMessage } from './chat/entities/chat-message.entity';
import { UserNickname } from './chat/entities/user-nickname.entity';
import {
  GlobalExceptionFilter,
  TraceMiddleware,
  TraceModule,
} from '@neticket/common';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const entities = [
          Venue,
          Block,
          Performance,
          Session,
          Grade,
          BlockGrade,
          ChatMessage,
          UserNickname,
        ];
        if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'dev') {
          return {
            type: 'sqlite',
            database: ':memory:',
            entities,
            synchronize: true,
            logging: process.env.NODE_ENV === 'dev',
          };
        }
        return {
          type: 'mysql',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '3306', 10),
          username: process.env.DB_USERNAME || 'app',
          password: process.env.DB_PASSWORD || 'test',
          database: process.env.DB_DATABASE || 'ticketing',
          entities,
          synchronize: false,
          logging: true,
          timezone: 'Z',
        };
      },
    }),
    VenuesModule,
    PerformancesModule,
    SeedingModule,
    KopisModule,
    ChatModule,
    UserModule,
    TraceModule,
  ],
  controllers: [],
  providers: [GlobalExceptionFilter, TraceMiddleware],
})
export class AppModule {}
