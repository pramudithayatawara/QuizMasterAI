import { useEffect, useRef, useCallback } from 'react';
import { getSocket, disconnectSocket, isSocketEnabled } from '../socket/socket.client.js';
import { useAuthStore } from '../store/auth.store.js';

/**
 * @hook useSocket
 * @description Hook for socket.io connection management with graceful failure handling.
 * @param {boolean} autoConnect - Connect on mount
 * @returns {{ socket, isConnected, connect, disconnect, on, emit, isAvailable }}
 */
export const useSocket = (autoConnect = true) => {
  const { accessToken, user } = useAuthStore();
  const socketRef             = useRef(null);

  const connect = useCallback(() => {
    if (!accessToken) return null;

    const socket = getSocket(accessToken);
    
    if (!socket) {
      console.log('[Socket] Socket not available (disabled or failed)');
      return null;
    }

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
    if (autoConnect && accessToken && isSocketEnabled()) {
      connect();
    }

    return () => {
      // Don't disconnect on unmount — singleton pattern
      // Only disconnect on logout
    };
  }, [autoConnect, accessToken, connect]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.log('[Socket] Cannot emit - socket not connected');
    }
  }, []);

  const on = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
      return () => socketRef.current?.off(event, handler);
    }
    // Return no-op cleanup if socket doesn't exist
    return () => {};
  }, []);

  return {
    socket:      socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    isAvailable: isSocketEnabled(),
    connect,
    disconnect: disconnectSocket,
    emit,
    on,
  };
};