import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 전역 JWT Guard를 사용할 때 특정 라우트를 공개(인증 불필요)로 설정하는 데코레이터
 * @example
 * @Controller('health')
 * export class HealthController {
 *   @Get()
 *   @Public() // 이 라우트는 토큰 없이도 접근 가능
 *   check() {
 *     return { status: 'ok' };
 *   }
 * }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
