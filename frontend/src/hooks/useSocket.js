import { useEffect, useRef, useCallback, useState } from 'react';
import { getSocket, disconnectSocket, isSocketEnabled, resetSocket } from '../socket/socket.client.js';
import { useAuthStore } from '../store/auth.store.js';

/**
 * @hook useSocket
 * @description Hook for socket.io connection management with graceful failure handling.
 * @param {boolean} autoConnect - Connect on mount
 * @returns {{ socket, isConnected, isAvailable, connect, disconnect, on, emit, retry }}
 */
export const useSocket = (autoConnect = true) => {
  const { accessToken, user } = useAuthStore();
  const socketRef             = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [available, setAvailable]     = useState(isSocketEnabled());

  const connect = useCallback(() => {
    if (!accessToken) return null;

    const socket = getSocket(accessToken);

    if (!socket) {
      setAvailable(false);
      return null;
    }

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      setAvailable(true);
      // Join personal room for targeted events
      socket.emit('joinPersonalRoom', { userId: user?._id });
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setIsConnected(false);
      // Reflect if socket was disabled after too many errors
      setAvailable(isSocketEnabled());
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socketRef.current = socket;
    setIsConnected(socket.connected);
    return socket;
  }, [accessToken, user?._id]);

  useEffect(() => {
    if (autoConnect && accessToken && isSocketEnabled()) {
      connect();
    }

    return () => {
      // Don't disconnect on unmount — singleton pattern
      // Only disconnect on logout (handled in auth store)
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

  // Manual retry for when socket was disabled
  const retry = useCallback(() => {
    resetSocket();
    setAvailable(true);
    setIsConnected(false);
    connect();
  }, [connect]);

  return {
    socket:      socketRef.current,
    isConnected,
    isAvailable: available,
    connect,
    disconnect:  disconnectSocket,
    emit,
    on,
    retry,
  };
};