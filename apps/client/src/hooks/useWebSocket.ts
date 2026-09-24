"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export interface WebSocketMessage<T = unknown> {
  type: string;
  notification?: T;
  [key: string]: unknown;
}

export function useWebSocket<T = unknown>(url: string | null) {
  const [isReady, setIsReady] = useState(false);
  const [val, setVal] = useState<T | null>(null);
  const ws = useRef<WebSocket | null>(null);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!url) {
      setIsReady(false);
      return;
    }

    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;

      try {
        const socket = new WebSocket(url);
        ws.current = socket;

        socket.onopen = () => {
          if (!isDisposed) setIsReady(true);
        };

        socket.onclose = () => {
          if (isDisposed) return;
          setIsReady(false);
          // Attempt reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        };

        socket.onerror = (error) => {
          if (isDisposed) return;
          // Use console.warn to avoid triggering the Next.js dev error overlay
          console.warn("[WebSocket] Connection notice:", error);
          setIsReady(false);
        };

        socket.onmessage = (event) => {
          if (isDisposed) return;
          try {
            const data = JSON.parse(event.data);
            setVal(data as T);
          } catch {
            setVal(event.data as unknown as T);
          }
        };
      } catch (err) {
        console.warn("[WebSocket] Failed to initialize:", err);
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        const socket = ws.current;
        ws.current = null;
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, "Clean cleanup");
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }
    };
  }, [url]);

  // 4. Function to send data back to Go
  const sendData = useCallback((data: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        typeof data === "object" ? JSON.stringify(data) : String(data),
      );
    }
  }, []);

  return { isReady, value: val, sendData };
}
