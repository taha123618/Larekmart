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

onMounted(async () => {
  try {
    const res = await api.get<any>("/api/v1/chat/conversations").catch(() => null);
    const list = Array.isArray(res)
      ? res
      : Array.isArray(res?.conversations)
        ? res.conversations
        : [];
    if (Array.isArray(list) && list.length > 0) {
      conversations.value = list;
      activeConversationId.value = list[0]?.id ?? null;
    } else {
      // Mock conversation for initial experience
      conversations.value = [
        {
          id: "conv_101",
          customerId: "cust_901",
          customerName: "Emily Davis",
          lastMessage: "Is this headphone compatible with PS5?",
          lastMessageTime: "10:24 AM",
          unreadCount: 1,
          productId: "prod_1",
          productName: "Premium ANC Wireless Headphones",
          status: "ACTIVE",
        },
        {
          id: "conv_102",
          customerId: "cust_902",
          customerName: "David Miller",
          lastMessage: "Thank you for the quick shipping!",
          lastMessageTime: "Yesterday",
          unreadCount: 0,
          status: "ACTIVE",
        },
      ];
      activeConversationId.value = "conv_101";
    }

    // Initial messages
    messages.value = [
      {
        id: "msg_1",
        conversationId: "conv_101",
        senderId: "cust_901",
        senderType: "CUSTOMER",
        senderName: "Emily Davis",
        text: "Hi! I am looking to purchase the Premium ANC Wireless Headphones. Is this model compatible with PlayStation 5 via 3.5mm or Bluetooth?",
        timestamp: "10:20 AM",
        read: true,
      },
      {
        id: "msg_2",
        conversationId: "conv_101",
        senderId: sellerStore.activeSellerId || "seller_me",
        senderType: "SELLER",
        senderName: sellerStore.activeStoreName,
        text: "Hello Emily! Yes, it supports low-latency 2.4GHz wireless dongle connection as well as direct 3.5mm analog input into the PS5 controller.",
        timestamp: "10:22 AM",
        read: true,
      },
      {
        id: "msg_3",
        conversationId: "conv_101",
        senderId: "cust_901",
        senderType: "CUSTOMER",
        senderName: "Emily Davis",
        text: "Awesome, does it come with the 3.5mm audio cable included in the box?",
        timestamp: "10:24 AM",
        read: false,
      },
    ];
  } catch {
    //
  } finally {
    isLoading.value = false;
    void scrollToBottom();
  }

  // Socket.IO listener for real-time messages
  const { $socket } = useNuxtApp();
  if ($socket) {
    $socket.on("chat:message", (msg: ChatMessage) => {
      if (msg.conversationId === activeConversationId.value) {
        messages.value.push(msg);
        void scrollToBottom();
      }
    });
  }
});

const selectConversation = (id: string) => {
  activeConversationId.value = id;
  void scrollToBottom();
};

const handleSendMessage = () => {
  const text = newMessageText.value.trim();
  if (!text || !activeConversationId.value) return;

  const newMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    conversationId: activeConversationId.value,
    senderId: sellerStore.activeSellerId || "me",
    senderType: "SELLER",
    senderName: sellerStore.activeStoreName,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    read: true,
  };

  messages.value.push(newMsg);
  newMessageText.value = "";
  void scrollToBottom();

  // Emit via Socket.io
  const { $socket } = useNuxtApp();
  if ($socket && $socket.connected) {
    $socket.emit("chat:send", newMsg);
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
        <!-- Active Chat Header -->
        <div
          v-if="activeConversation"
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
            Online
          </span>
        </div>

        <!-- Messages Stream -->
        <div
          ref="messagesContainer"
          class="flex-1 overflow-y-auto p-6 space-y-4"
        >
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
      </div>
    </div>
  </div>
</template>
