import { useMutation, useQuery } from "@tanstack/react-query";
import { CurrentQueueResponse, EntryResponse } from "../types/entryType";
import { api } from "@/lib/api/api";

const TICKETING_NOT_OPEN_CODE = "QUEUE_TICKETING_NOT_OPEN";
const ENTER_QUEUE_MAX_RETRIES = 5;
// 동시 재시도로 인한 thundering herd 방지: 800~1800ms 사이 랜덤 지연
const retryDelay = () => 800 + Math.random() * 1000;

export const useEnterQueue = () => {
  return useMutation({
    mutationFn: async () => {
      for (let attempt = 0; attempt <= ENTER_QUEUE_MAX_RETRIES; attempt++) {
        try {
          return await api.post<EntryResponse>(
            `/queue/entries`,
            {},
            { serverType: "queue", credentials: "include" },
          );
        } catch (err) {
          const isNotOpen =
            err instanceof Error &&
            err.message.includes(TICKETING_NOT_OPEN_CODE);

          if (!isNotOpen || attempt === ENTER_QUEUE_MAX_RETRIES) throw err;

          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay()),
          );
        }
      }
      throw new Error("대기열 진입에 실패했습니다.");
    },
  });
};

export const useCurrentQueue = (hasToken: boolean = false) => {
  return useQuery({
    queryKey: ["currentQueue"],
    queryFn: async () => {
      const response = await api.get<CurrentQueueResponse>(
        `/queue/entries/me`,
        { serverType: "queue", credentials: "include" },
      );
      return response;
    },
    enabled: hasToken,
    refetchInterval: 2000,
    gcTime: 0,
  });
};
