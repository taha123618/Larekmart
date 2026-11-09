<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from "vue";
import { useApi } from "~/composables/useApi";
import { useSellerStore } from "~/stores/seller.store";
import type { ChatConversation, ChatMessage } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();
const sellerStore = useSellerStore();

const conversations = ref<ChatConversation[]>([]);
const activeConversationId = ref<string | null>(null);
const messages = ref<ChatMessage[]>([]);
const newMessageText = ref("");
const isLoading = ref(true);
const messagesContainer = ref<HTMLElement | null>(null);

const activeConversation = computed(() => {
  return (
    conversations.value.find((c) => c.id === activeConversationId.value) ||
    conversations.value[0] ||
    null
  );
});

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const fetchMessages = async (convId: string) => {
  if (!convId) {
    messages.value = [];
    return;
  }
  try {
    const res = await api.get<any>(`/api/v1/chat/conversations/${convId}/messages`).catch(() => []);
    const list = Array.isArray(res)
      ? res
      : Array.isArray(res?.messages)
        ? res.messages
        : [];
    messages.value = list;
    void scrollToBottom();
  } catch {
    messages.value = [];
  }
};

onMounted(async () => {
  try {
    const res = await api.get<any>("/api/v1/chat/conversations").catch(() => null);
    const list = Array.isArray(res)
      ? res
      : Array.isArray(res?.conversations)
        ? res.conversations
        : [];
    conversations.value = list;
    if (Array.isArray(list) && list.length > 0 && list[0]?.id) {
      activeConversationId.value = list[0].id;
      await fetchMessages(list[0].id);
    } else {
      activeConversationId.value = null;
      messages.value = [];
    }
  } catch {
    conversations.value = [];
    messages.value = [];
    activeConversationId.value = null;
  } finally {
    isLoading.value = false;
    void scrollToBottom();
  }

  // Socket.IO listener for real-time messages
  const { $socket } = useNuxtApp() as any;
  if ($socket) {
    $socket.on("chat:message", (msg: ChatMessage) => {
      if (msg.conversationId === activeConversationId.value) {
        messages.value.push(msg);
        void scrollToBottom();
      }
    });
  }
});

const selectConversation = async (id: string) => {
  activeConversationId.value = id;
  await fetchMessages(id);
};

const handleSendMessage = async () => {
  const text = newMessageText.value.trim();
  if (!text || !activeConversationId.value) return;

  const convId = activeConversationId.value;
  newMessageText.value = "";

  const localMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    conversationId: convId,
    senderId: sellerStore.activeSellerId || "me",
    senderType: "SELLER",
    senderName: sellerStore.activeStoreName,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    read: true,
  };

  messages.value.push(localMsg);
  void scrollToBottom();

  try {
    await api.post(`/api/v1/chat/conversations/${convId}/messages`, { text }).catch(() => null);
  } catch {
    // Socket relay fallback
  }

  // Emit via Socket.io
  const { $socket } = useNuxtApp() as any;
  if ($socket && $socket.connected) {
    $socket.emit("chat:send", localMsg);
  }
};
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Buyer-Seller Messaging"
      description="Connect directly with prospective customers, address pre-purchase inquiries, and provide live support."
    />

    <div
      class="flex h-[calc(100vh-280px)] min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <!-- Conversation Sidebar -->
      <div
        class="w-full sm:w-80 border-r border-slate-200 flex flex-col shrink-0 dark:border-slate-800"
      >
        <div class="border-b border-slate-100 p-3.5 dark:border-slate-800">
          <input
            type="search"
            placeholder="Search messages..."
            class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div class="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          <div v-if="conversations.length === 0" class="p-8 text-center text-xs text-slate-400">
            <UIcon name="i-heroicons-chat-bubble-bottom-center-text" class="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p class="font-medium text-slate-600 dark:text-slate-400">No buyer messages</p>
            <p class="mt-1 text-[11px] text-slate-400">Inquiries from customers will appear here in real time.</p>
          </div>
          <div
            v-for="c in conversations"
            :key="c.id"
            :class="[
              'cursor-pointer p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60',
              c.id === activeConversationId
                ? 'bg-primary-50/70 dark:bg-primary-950/40'
                : '',
            ]"
            @click="selectConversation(c.id)"
          >
            <div class="flex items-center justify-between">
              <span class="font-semibold text-xs text-slate-900 dark:text-white truncate">
                {{ c.customerName }}
              </span>
              <span class="text-[10px] text-slate-400">{{ c.lastMessageTime }}</span>
            </div>
            <p v-if="c.productName" class="mt-0.5 truncate text-[11px] font-medium text-primary-600 dark:text-primary-400">
              Re: {{ c.productName }}
            </p>
            <p class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {{ c.lastMessage }}
            </p>
          </div>
        </div>
      </div>

      <!-- Chat Room Stream -->
      <div class="hidden sm:flex flex-1 flex-col">
        <div
          v-if="!activeConversation"
          class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400"
        >
          <UIcon name="i-heroicons-chat-bubble-left-right" class="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
          <p class="font-semibold text-sm text-slate-700 dark:text-slate-300">No Conversation Selected</p>
          <p class="text-xs text-slate-400 mt-1">Select an active conversation to respond to customer inquiries.</p>
        </div>

        <template v-else>
          <!-- Active Chat Header -->
          <div
            class="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 dark:border-slate-800"
          >
            <div>
              <h3 class="font-bold text-xs text-slate-900 dark:text-white">
                {{ activeConversation.customerName }}
              </h3>
              <p
                v-if="activeConversation.productName"
                class="text-[10px] text-slate-500 dark:text-slate-400"
              >
                Inquiring about: <span class="font-semibold text-slate-700 dark:text-slate-300">{{ activeConversation.productName }}</span>
              </p>
            </div>

            <span class="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          <!-- Messages Stream -->
          <div
            ref="messagesContainer"
            class="flex-1 overflow-y-auto p-6 space-y-4"
          >
            <div v-if="messages.length === 0" class="py-12 text-center text-xs text-slate-400">
              No message history in this conversation.
            </div>
            <div
              v-for="msg in messages"
              :key="msg.id"
              :class="[
                'flex flex-col max-w-[70%]',
                msg.senderType === 'SELLER' ? 'ml-auto items-end' : 'mr-auto items-start',
              ]"
            >
              <div
                :class="[
                  'rounded-2xl px-4 py-2.5 text-xs shadow-xs',
                  msg.senderType === 'SELLER'
                    ? 'bg-primary-600 text-white rounded-br-none'
                    : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white rounded-bl-none',
                ]"
              >
                {{ msg.text }}
              </div>
              <span class="mt-1 text-[9px] text-slate-400">
                {{ msg.timestamp }}
              </span>
            </div>
          </div>

          <!-- Chat Input Bar -->
          <form
            class="border-t border-slate-200 p-4 flex items-center gap-3 dark:border-slate-800"
            @submit.prevent="handleSendMessage"
          >
            <input
              v-model="newMessageText"
              type="text"
              placeholder="Write a message to customer..."
              class="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              :disabled="!newMessageText.trim()"
              class="rounded-xl bg-primary-600 p-2.5 text-white shadow-xs transition hover:bg-primary-700 disabled:opacity-40"
            >
              <UIcon name="i-heroicons-paper-airplane" class="h-4 w-4" />
            </button>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>
