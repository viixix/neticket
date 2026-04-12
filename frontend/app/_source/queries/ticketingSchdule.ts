import { api } from "@/lib/api/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ResponsePerformances, Performance } from "@/types/performance";

const getSimulationCacheTime = (data?: Performance[]) => {
  if (!data?.[0]) return 0;

  const simulationTime = new Date(data[0].ticketing_date).getTime();
  const now = new Date().getTime();
  const diff = simulationTime - now;

  return Math.max(0, diff);
};

export const useScheduledTicketingQuery = (
  ticketingAfter: Date | null,
  limit: number | null,
) => {
  return useSuspenseQuery<Performance[]>({
    queryKey: ["performances", ticketingAfter, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (ticketingAfter) {
        params.ticketing_after = ticketingAfter.toISOString();
      }
      if (limit) {
        params.limit = limit;
      }

      const res = await api.get<ResponsePerformances>("/performances", {
        serverType: "show",
        params,
      });

      if (res.performances.length === 0) {
        throw new Error("공연 정보를 찾을 수 없습니다.");
      }
      return res.performances;
    },
    staleTime: (query) => getSimulationCacheTime(query.state.data),
    gcTime: 1000 * 60 * 60 * 24, // 24시간
  });
};
