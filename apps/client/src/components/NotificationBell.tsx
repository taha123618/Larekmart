"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { NotificationType } from "@repo/types";
import { useWebSocket, type WebSocketMessage } from "@/hooks/useWebSocket";

interface NotificationResponse {
  notifications: NotificationType[];
  unread_count: number;
  total: number;
}

export default function NotificationBell() {
  const { getToken, isSignedIn, userId } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const serviceUrl =
    process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    "http://localhost:8090";
  const wsUrl =
    process.env.NEXT_PUBLIC_NOTIFICATION_WS_URL || "ws://localhost:8080/ws";

  // Fetch Clerk session token
  useEffect(() => {
    if (!isSignedIn) {
      setToken(null);
      return;
    }
    let isMounted = true;
    getToken().then((t) => {
      if (isMounted) setToken(t);
    });
    return () => {
      isMounted = false;
    };
  }, [isSignedIn, getToken]);

  // 1. React Query for fetching notifications via axios
  const { data, isLoading } = useQuery<NotificationResponse>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const currentToken = token || (await getToken());
      if (!currentToken) {
        return { notifications: [], unread_count: 0, total: 0 };
      }

      const response = await axios.get<NotificationResponse>(
        `${serviceUrl}/notifications?limit=10`,
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        },
      );
      return {
        unread_count: response.data?.unread_count ?? 0,
        total: response.data?.total ?? 0,
        notifications: Array.isArray(response.data?.notifications)
          ? response.data.notifications
          : [],
      };
    },
    enabled: !!isSignedIn,
    staleTime: 30 * 1000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unread_count || 0;

  // 2. WebSocket connection using useWebSocket hook
  const activeWsUrl =
    isSignedIn && userId
      ? `${wsUrl}?user_id=${encodeURIComponent(userId)}`
      : null;

  const { isReady, value } =
    useWebSocket<WebSocketMessage<NotificationType>>(activeWsUrl);

  // Sync real-time WebSocket events to React Query cache
  useEffect(() => {
    if (!value) return;

    if (value.type === "notification" && value.notification) {
      const newNotif = value.notification;
      queryClient.setQueryData<NotificationResponse>(
        ["notifications"],
        (prev) => {
          const prevList = Array.isArray(prev?.notifications)
            ? prev.notifications
            : [];
          // Avoid duplicate notifications in local state
          const exists = prevList.some((n) => n.id === newNotif.id);
          if (exists) {
            return (
              prev ?? {
                notifications: [newNotif],
                unread_count: 1,
                total: 1,
              }
            );
          }

          return {
            notifications: [newNotif, ...prevList],
            unread_count: (prev?.unread_count ?? 0) + 1,
            total: (prev?.total ?? 0) + 1,
          };
        },
      );
    }
  }, [value, queryClient]);

  // 3. React Query Mutation for marking single notification as read
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const currentToken = token || (await getToken());
      if (!currentToken) return;

      await axios.patch(
        `${serviceUrl}/notifications/${id}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        },
      );
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previousData = queryClient.getQueryData<NotificationResponse>([
        "notifications",
      ]);

      if (previousData) {
        const prevList = Array.isArray(previousData.notifications)
          ? previousData.notifications
          : [];
        queryClient.setQueryData<NotificationResponse>(["notifications"], {
          ...previousData,
          unread_count: Math.max(0, previousData.unread_count - 1),
          notifications: prevList.map((n) =>
            n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
          ),
        });
      }
      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["notifications"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 4. React Query Mutation for marking all notifications as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const currentToken = token || (await getToken());
      if (!currentToken) return;

      await axios.patch(
        `${serviceUrl}/notifications/read-all`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        },
      );
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previousData = queryClient.getQueryData<NotificationResponse>([
        "notifications",
      ]);

      if (previousData) {
        const prevList = Array.isArray(previousData.notifications)
          ? previousData.notifications
          : [];
        queryClient.setQueryData<NotificationResponse>(["notifications"], {
          ...previousData,
          unread_count: 0,
          notifications: prevList.map((n) => ({
            ...n,
            read_at: new Date().toISOString(),
          })),
        });
      }
      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["notifications"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!isSignedIn) {
    return (
      <Bell className="w-4 h-4 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50" />
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all focus:outline-none cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-sm shadow-rose-500/30">
            <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
            <span className="relative">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-2xl p-4 shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Notifications
              </h3>
              <span
                title={isReady ? "Live WebSocket Connected" : "Connecting..."}
                className="flex items-center"
              >
                {isReady ? (
                  <Wifi className="w-3 h-3 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-slate-400 dark:text-slate-600" />
                )}
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold disabled:opacity-50 cursor-pointer transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100/60 dark:divide-slate-800/60 py-1 no-scrollbar">
            {isLoading ? (
              <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                Loading notifications...
              </p>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  You are all caught up!
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Order updates and promos will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`py-3 px-2.5 my-1 flex items-start justify-between gap-3 rounded-xl transition-all ${
                    !n.read_at
                      ? "bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100/60 dark:border-indigo-900/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-relaxed">
                      {n.body}
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 block font-mono">
                      {new Date(n.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {!n.read_at && (
                    <button
                      onClick={() => markReadMutation.mutate(n.id)}
                      disabled={markReadMutation.isPending}
                      title="Mark as read"
                      className="p-1 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
