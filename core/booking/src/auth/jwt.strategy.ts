import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@neticket/contracts';
import { REDIS_KEY_PREFIXES } from '@neticket/contracts';
import { AUTH_ERROR_CODES, AuthException } from '@neticket/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const secret = configService.get<string>('jwt.secret') || 'secret';

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: { cookies?: { activeToken?: string } }) => {
          // Cookie에서도 토큰 추출 지원
          return (req?.cookies?.activeToken as string | null) || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // payload 타입 검증
    if (payload.type !== 'TICKETING') {
      throw new AuthException(
        AUTH_ERROR_CODES.INVALID_TOKEN_TYPE,
        '유효하지 않은 토큰 타입입니다.',
        401,
      );
    }

    // userId 검증
    if (!payload.sub) {
      throw new AuthException(
        AUTH_ERROR_CODES.INVALID_TOKEN_PAYLOAD,
        '유효하지 않은 토큰 페이로드입니다.',
        401,
      );
    }

    const activeUserKey = `${REDIS_KEY_PREFIXES.ACTIVE_USER}${payload.sub}`;
    try {
      const isActive = await this.redisService.existsInQueue(activeUserKey);
      if (!isActive) {
        throw new AuthException(
          AUTH_ERROR_CODES.USER_NOT_ACTIVE,
          '활성 큐에 있지 않은 사용자입니다.',
          401,
        );
      }
    } catch (e) {
      if (e instanceof AuthException) throw e;
      // redis-queue 장애 시 JWT 단독 검증으로 폴백 (activeTTL = JWT TTL = 60s로 동등)
    }

    // validate 메서드가 반환하는 값이 request.user에 할당됨
    return {
      userId: payload.sub,
      type: payload.type,
      sessionIds: payload.sessionIds ?? [],
    };
  }
}
