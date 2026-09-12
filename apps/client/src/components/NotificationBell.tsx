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
  const { getToken, isSignedIn } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const serviceUrl =
    process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || "http://localhost:8005";
  const wsUrl =
    process.env.NEXT_PUBLIC_NOTIFICATION_WS_URL || "ws://localhost:8005/ws";

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
      return response.data;
    },
    enabled: !!isSignedIn,
    staleTime: 30 * 1000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unread_count || 0;

  // 2. WebSocket connection using useWebSocket hook
  const activeWsUrl =
    isSignedIn && token ? `${wsUrl}?token=${encodeURIComponent(token)}` : null;

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
          if (!prev) {
            return {
              notifications: [newNotif],
              unread_count: 1,
              total: 1,
            };
          }
          // Avoid duplicate notifications in local state
          const exists = prev.notifications.some((n) => n.id === newNotif.id);
          if (exists) return prev;

          return {
            ...prev,
            unread_count: prev.unread_count + 1,
            total: prev.total + 1,
            notifications: [newNotif, ...prev.notifications],
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
        queryClient.setQueryData<NotificationResponse>(["notifications"], {
          ...previousData,
          unread_count: Math.max(0, previousData.unread_count - 1),
          notifications: previousData.notifications.map((n) =>
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
        queryClient.setQueryData<NotificationResponse>(["notifications"], {
          ...previousData,
          unread_count: 0,
          notifications: previousData.notifications.map((n) => ({
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
      <Bell className="w-4 h-4 text-gray-400 cursor-not-allowed opacity-60" />
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-gray-100 bg-white p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Notifications
              </h3>
              <span
                title={isReady ? "Live WebSocket Connected" : "Connecting..."}
                className="flex items-center"
              >
                {isReady ? (
                  <Wifi className="w-3 h-3 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-gray-300" />
                )}
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 py-1">
            {isLoading ? (
              <p className="py-6 text-center text-xs text-gray-400">
                Loading notifications...
              </p>
            ) : notifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`py-3 px-2 flex items-start justify-between gap-3 rounded-lg transition-colors ${
                    !n.read_at ? "bg-blue-50/50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">
                      {n.body}
                    </p>
                    <span className="text-[10px] text-gray-400 mt-1 block">
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
                      className="p-1 text-gray-400 hover:text-blue-600 rounded disabled:opacity-50 cursor-pointer"
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
