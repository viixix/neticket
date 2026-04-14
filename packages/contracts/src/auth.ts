/**
 * JWT 토큰 Payload 인터페이스
 * Queue Server에서 발급하고 Ticket Server에서 검증하는 활성 토큰의 구조
 */
export interface JwtPayload {
  sub: string; // userId
  type: string; // 'TICKETING'
  iat?: number; // issued at
  exp?: number; // expires at
}

/**
 * JWT 검증 후 request.user에 할당되는 사용자 정보
 */
export interface ActiveUser {
  userId: string;
  type: string;
}
