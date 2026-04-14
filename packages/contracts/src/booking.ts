export interface BookingRequest {
  userId: string;
  ticketId: string;
  seatNumber: string;
}

export interface BookingResponse {
  bookingId: string;
  status: 'pending' | 'confirmed' | 'failed';
  message?: string;
}
