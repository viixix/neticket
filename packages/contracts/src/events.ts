export interface BookingDoneEvent {
  userId: string;
  bookingId: string;
  timestamp: number;
}

export interface QueueUpdateEvent {
  type: 'enter' | 'exit' | 'activate';
  userId: string;
  timestamp: number;
}
