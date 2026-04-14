import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserNickname } from '../chat/entities/user-nickname.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserNickname])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
