'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { auth } from '@/lib/firebase';
import { notificationsApi } from '@/lib/api';

let socket: Socket | null = null;
let socketUserId: string | null = null;

function getSocket(userId: string, token?: string | null): Socket {
  if (socket && socketUserId !== userId) {
    socket.disconnect();
    socket = null;
    socketUserId = null;
  }
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/kanban`, {
      withCredentials: true,
      auth: token ? { token } : undefined,
    });
    socketUserId = userId;
  }
  return socket;
}

export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();
  const joinedRef = useRef(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  useEffect(() => {
    if (!userId) {
      // Sign-out: disconnect and clear the singleton so the next user gets a fresh socket
      if (socket) {
        socket.disconnect();
        socket = null;
        socketUserId = null;
      }
      return;
    }
    let cleanup: (() => void) | undefined;

    (auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)).then((token) => {
      const s = getSocket(userId, token);

      if (!joinedRef.current) {
        s.emit('join:user', userId);
        joinedRef.current = true;
      }

      const onNotification = () => {
        setUnreadCount((c) => c + 1);
        refreshUnread();
      };

      s.on('notification:created', onNotification);

      cleanup = () => {
        s.off('notification:created', onNotification);
        joinedRef.current = false;
      };
    }).catch(() => {});

    return () => cleanup?.();
  }, [userId, refreshUnread]);

  const markRead = useCallback(async (id: string) => {
    await notificationsApi.markRead(id);
    setUnreadCount((c) => Math.max(0, c - 1));
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    setUnreadCount(0);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  return { unreadCount, setUnreadCount, markRead, markAllRead };
}
