import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

let globalSocket: Socket | null = null;

function getSocket(role: string, userId?: string | number): Socket {
  if (globalSocket?.connected) return globalSocket;

  const socketUrl = window.location.origin;
  globalSocket = io(socketUrl, {
    query: { role, userId: String(userId ?? "") },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  return globalSocket;
}

export function useSocket(
  role: string,
  userId: string | number | undefined,
  handlers: Record<string, (data: any) => void>,
) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!role) return;

    const socket = getSocket(role, userId);
    socketRef.current = socket;

    const registeredEvents = Object.keys(handlersRef.current);

    const wrappedHandlers: Record<string, (data: any) => void> = {};
    for (const event of registeredEvents) {
      wrappedHandlers[event] = (data: any) => handlersRef.current[event]?.(data);
      socket.on(event, wrappedHandlers[event]);
    }

    return () => {
      for (const event of registeredEvents) {
        socket.off(event, wrappedHandlers[event]);
      }
    };
  }, [role, userId]);

  return socketRef.current;
}
