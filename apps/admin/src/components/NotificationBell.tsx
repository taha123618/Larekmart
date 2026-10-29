"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { NotificationType } from "@repo/types";
import { Button } from "./ui/button";
import { useWebSocket, type WebSocketMessage } from "@/hooks/useWebSocket";
import { getApiGatewayUrl, getNotificationWsUrl } from "@/services/gateway.service";

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

  const serviceUrl = getApiGatewayUrl();
  const wsUrl = getNotificationWsUrl();

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
    queryKey: ["admin_notifications"],
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
        ["admin_notifications"],
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
      await queryClient.cancelQueries({ queryKey: ["admin_notifications"] });
      const previousData = queryClient.getQueryData<NotificationResponse>([
        "admin_notifications",
      ]);

      if (previousData) {
        const prevList = Array.isArray(previousData.notifications)
          ? previousData.notifications
          : [];
        queryClient.setQueryData<NotificationResponse>(
          ["admin_notifications"],
          {
            ...previousData,
            unread_count: Math.max(0, previousData.unread_count - 1),
            notifications: prevList.map((n) =>
              n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
            ),
          },
        );
      }
      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["admin_notifications"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_notifications"] });
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
      await queryClient.cancelQueries({ queryKey: ["admin_notifications"] });
      const previousData = queryClient.getQueryData<NotificationResponse>([
        "admin_notifications",
      ]);

      if (previousData) {
        const prevList = Array.isArray(previousData.notifications)
          ? previousData.notifications
          : [];
        queryClient.setQueryData<NotificationResponse>(
          ["admin_notifications"],
          {
            ...previousData,
            unread_count: 0,
            notifications: prevList.map((n) => ({
              ...n,
              read_at: new Date().toISOString(),
            })),
          },
        );
      }
      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["admin_notifications"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_notifications"] });
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

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        aria-label="Notifications"
      >
        <Bell className="h-[1.2rem] w-[1.2rem]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border bg-popover text-popover-foreground p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Admin Notifications</h3>
              <span
                title={isReady ? "Live WebSocket Connected" : "Connecting..."}
                className="flex items-center"
              >
                {isReady ? (
                  <Wifi className="w-3 h-3 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-muted-foreground/40" />
                )}
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs text-primary hover:underline font-medium cursor-pointer disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border py-1">
            {isLoading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Loading notifications...
              </p>
            ) : notifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No new notifications
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`py-3 px-2 flex items-start justify-between gap-3 rounded-lg transition-colors ${
                    !n.read_at ? "bg-muted/60" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {n.body}
                    </p>
                    <span className="text-[10px] text-muted-foreground/70 mt-1 block">
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
                      className="p-1 text-muted-foreground hover:text-primary rounded cursor-pointer disabled:opacity-50"
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
