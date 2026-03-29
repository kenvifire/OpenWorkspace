'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';

let socket: Socket | null = null;

function getSocket(token?: string | null): Socket {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/kanban`, {
      withCredentials: true,
      auth: token ? { token } : undefined,
    });
  } else if (token && !(socket.auth as Record<string, string> | undefined)?.token) {
    (socket.auth as Record<string, string>) = { token };
    socket.disconnect().connect();
  }
  return socket;
}

type KanbanEvent = 'task:created' | 'task:updated' | 'task:deleted' | 'comment:created';

export function useKanban(projectId: string) {
  const queryClient = useQueryClient();
  const joinedRef = useRef(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    (auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)).then((token) => {
      const s = getSocket(token);

      if (!joinedRef.current) {
        s.emit('join:project', projectId);
        joinedRef.current = true;
      }

      const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      };

      const events: KanbanEvent[] = ['task:created', 'task:updated', 'task:deleted', 'comment:created'];
      events.forEach((e) => s.on(e, invalidate));

      cleanup = () => {
        events.forEach((e) => s.off(e, invalidate));
        s.emit('leave:project', projectId);
        joinedRef.current = false;
      };
    });

    return () => cleanup?.();
  }, [projectId, queryClient]);
}
