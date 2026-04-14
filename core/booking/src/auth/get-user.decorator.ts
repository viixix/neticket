import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActiveUser } from '@neticket/contracts';

/**
 * JWT Guard를 통과한 후 request.user에서 사용자 정보를 추출하는 데코레이터
 * @example
 * @Get('my-booking')
 * @UseGuards(JwtAuthGuard)
 * getMyBooking(@GetUser() user: ActiveUser) {
 *   return this.bookingService.findByUserId(user.userId);
 * }
 */
export const GetUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveUser => {
    const request = ctx.switchToHttp().getRequest<{ user: ActiveUser }>();
    return request.user;
  },
);
