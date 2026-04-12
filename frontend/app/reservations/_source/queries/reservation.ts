import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/api";

interface ReservedSeat {
  block_id: number;
  row: number;
  col: number;
}

interface ReservationResult {
  reserved_at: string;
  virtual_user_size?: number | null;
  rank: number;
  seats: ReservedSeat[];
}

interface ReservationPayload {
  session_id: number;
  seats: ReservedSeat[];
}

export const useReservationMutation = (token: string) => {
  return useMutation({
    mutationFn: async (payload: ReservationPayload) => {
      const response = await api.post<ReservationResult>(
        "/reservations",
        payload,
        {
          serverType: "booking",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response;
    },
  });
};
