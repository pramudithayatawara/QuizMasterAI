import { useEffect, useRef, useCallback } from 'react';
import { getSocket, disconnectSocket } from '../socket/socket.client.js';
import { useAuthStore } from '../store/auth.store.js';

/**
 * @hook useSocket
 * @description Hook for socket.io connection management.
 * @param {boolean} autoConnect - Connect on mount
 * @returns {{ socket, isConnected, connect, disconnect, on, emit }}
 */
export const useSocket = (autoConnect = true) => {
  const { accessToken, user } = useAuthStore();
  const socketRef             = useRef(null);

  const connect = useCallback(() => {
    if (!accessToken) return null;

    const socket = getSocket(accessToken);

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      // Join personal room for targeted events
      socket.emit('joinPersonalRoom', { userId: user?._id });
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socketRef.current = socket;
    return socket;
  }, [accessToken, user?._id]);

  useEffect(() => {
    if (autoConnect && accessToken) {
      connect();
    }

    return () => {
      // Don't disconnect on unmount — singleton pattern
      // Only disconnect on logout
    };
  }, [autoConnect, accessToken, connect]);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return {
    socket:      socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    connect,
    disconnect:  disconnectSocket,
    emit,
    on,
  };
};