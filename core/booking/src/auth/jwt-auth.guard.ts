import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AUTH_ERROR_CODES, AuthException } from '@neticket/common';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // @Public() 데코레이터가 있는지 확인
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Public 라우트는 토큰 검증 건너뛰기
    if (isPublic) {
      return true;
    }

    // JWT Strategy의 validate 메서드를 호출
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // 토큰이 없거나 검증 실패 시
    if (err || !user) {
      if ((info as { name?: string })?.name === 'TokenExpiredError') {
        throw new AuthException(
          AUTH_ERROR_CODES.ACTIVE_TOKEN_EXPIRED,
          '인증 토큰이 만료되었습니다.',
          401,
        );
      }
      if ((info as { name?: string })?.name === 'JsonWebTokenError') {
        throw new AuthException(
          AUTH_ERROR_CODES.INVALID_ACTIVE_TOKEN,
          '유효하지 않은 인증 토큰입니다.',
          401,
        );
      }

      if (err instanceof AuthException) {
        throw err;
      }
      throw new AuthException(
        AUTH_ERROR_CODES.ACTIVE_TOKEN_REQUIRED,
        err instanceof Error ? err.message : '인증 토큰이 필요합니다.',
        401,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
