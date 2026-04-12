import { api } from '@/lib/api/api';
import { ResponsePerformances, Session } from '@/types/performance';

export async function getLatestPerformance() {
  const now = new Date();
  const minutes = now.getMinutes();

  // 5분 단위로 내림
  const roundedMinutes = Math.floor(minutes / 5) * 5;
  const minutesInRound = minutes - roundedMinutes;

  // 3분 이후면 다음 라운드로 이동
  const targetMinutes = minutesInRound >= 3 ? roundedMinutes + 5 : roundedMinutes;

  const targetDate = new Date(now);
  targetDate.setMinutes(targetMinutes);
  targetDate.setSeconds(0);
  targetDate.setMilliseconds(0);

  const formattedDate = targetDate.toISOString();

  const response = await api.get<ResponsePerformances>(
    `/performances?limit=1&ticketing_after=${formattedDate}`,
    {
      next: {
        revalidate: process.env.NODE_ENV === 'production' ? 60 : 0,
        tags: ['performance', 'latest-performance'],
      },
    },
  );

  if (!response.performances || response.performances.length === 0) {
    throw new Error('공연 정보를 찾을 수 없습니다.');
  }

  return response.performances[0];
}

export async function getSessions(performanceId: number) {
  if (!performanceId) return [];
  const response = await api.get<Session[]>(
    `/performances/${performanceId}/sessions`,
    {
      next: {
        revalidate: 60,
        tags: ['performance', `performance-${performanceId}`, 'sessions'],
      },
    },
  );

  return response;
}
