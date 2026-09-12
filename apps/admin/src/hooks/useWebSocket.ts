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

  useEffect(() => {
    if (!url) {
      setIsReady(false);
      return;
    }

    // 1. Initialize connection
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => setIsReady(true);
    socket.onclose = () => setIsReady(false);
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsReady(false);
    };

    // 2. Handle incoming data from Go backend
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setVal(data as T);
      } catch {
        setVal(event.data as unknown as T);
      }
    };

    // 3. Clean up on component unmount or URL change
    return () => {
      socket.close();
      ws.current = null;
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
