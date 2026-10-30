export type TicketThreadMessage = { id: string; message: string; author_user_id?: string | null; created_at?: string | null };

export function getTicketThreadView(description: unknown, messages: TicketThreadMessage[]) {
  const initialRequest = String(description ?? "").trim();
  const firstIsInitialRequest = initialRequest.length > 0 && messages[0]?.message.trim() === initialRequest;
  return {
    initialRequest,
    replies: firstIsInitialRequest ? messages.slice(1) : messages,
  };
}
