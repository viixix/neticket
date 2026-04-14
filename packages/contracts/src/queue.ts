export interface QueueEntryResponse {
  userId: string;
  position: number | null;
}

export interface QueueStatusResponse {
  position: number | null;
  status: "open" | "closed";
  token?: string;
}
