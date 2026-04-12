import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  NolBlockDataResponse,
  NolReservationResponse,
  NolSeatDataResponse,
} from "../types/reservationType";

interface ReservationResponse {
  seats: boolean[][];
}

export const useReservationSeatsQuery = (
  sessionId: number,
  blockId: string | null,
) => {
  const { token } = useAuth();
  return useSuspenseQuery<ReservationResponse>({
    queryKey: ["reservation-seats", sessionId, blockId],
    queryFn: async () => {
      const res = await api.get<ReservationResponse>(
        `/reservations?session_id=${sessionId}&block_id=${blockId}`,
        {
          serverType: "booking",
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return res;
    },
    staleTime: 0,
    gcTime: 0,
    retry: 0,
  });
};

// Nol

export const useNolSeatMetaQuery = (id: string = "") => {
  return useSuspenseQuery({
    queryKey: ["nol-seat", id],
    queryFn: async () => {
      const response = await api.get<NolSeatDataResponse>(`/nol-seat-meta`);
      return response;
    },
  });
};

export const useNolBlockSeatQuery = (id: string = "") => {
  return useSuspenseQuery({
    queryKey: ["nol-blockSeat", id],
    queryFn: async () => {
      const response = await api.get<NolBlockDataResponse>(`/nol-block-data`);

      return response;
    },
  });
};

export const useNolReservedSeatQuery = (id: string = "") => {
  return useSuspenseQuery({
    queryKey: ["nol-reservedSeat", id],
    queryFn: async () => {
      const response =
        await api.get<NolReservationResponse>(`/nol-reservations`);

      return response;
    },
  });
};
