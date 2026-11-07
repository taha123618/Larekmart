import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import type { MaybeRef } from "vue";
import type {
  SupportTicket,
  ChatConversation,
  ChatMessage,
  PaginatedResponse,
} from "~/types/seller";

export function useSupportTickets(params?: { page?: number; status?: string }) {
  const { apiFetch } = useApi();

  return useQuery({
    queryKey: computed(() => ["support", "tickets", params]),
    queryFn: () =>
      apiFetch<PaginatedResponse<SupportTicket>>("/api/v1/support/tickets", {
        query: { page: params?.page ?? 1, status: params?.status },
      }),
  });
}

export function useCreateTicket() {
  const { apiFetch } = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      subject: string;
      description: string;
      category: string;
      categoryCode?: string;
      priority?: SupportTicket["priority"];
      source?: string;
      sellerId?: string;
    }) =>
      apiFetch<SupportTicket>("/api/v1/support/tickets", {
        method: "POST",
        body: {
          ...body,
          categoryCode: body.categoryCode || body.category,
          source: body.source || "SELLER",
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support", "tickets"] });
    },
  });
}

export function useChatConversations(sellerId: MaybeRef<string>) {
  const { apiFetch } = useApi();
  const id = computed(() => unref(sellerId));

  return useQuery({
    queryKey: computed(() => ["chat", "conversations", id.value]),
    queryFn: () =>
      apiFetch<PaginatedResponse<ChatConversation>>(
        `/api/v1/chat/conversations?sellerId=${id.value}`
      ),
    enabled: computed(() => !!id.value),
    refetchInterval: 10000, // poll every 10s as fallback
  });
}

export function useChatMessages(conversationId: MaybeRef<string>) {
  const { apiFetch } = useApi();
  const id = computed(() => unref(conversationId));

  return useQuery({
    queryKey: computed(() => ["chat", "messages", id.value]),
    queryFn: () =>
      apiFetch<PaginatedResponse<ChatMessage>>(
        `/api/v1/chat/conversations/${id.value}/messages`
      ),
    enabled: computed(() => !!id.value),
  });
}
