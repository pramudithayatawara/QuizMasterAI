import { io } from 'socket.io-client';

/**
 * @module socketClient
 * @description Singleton Socket.io client instance.
 */

// In development, use the proxy URL; in production, use the direct URL
const SOCKET_URL = import.meta.env.MODE === 'development' 
  ? window.location.origin 
  : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');

let socketInstance = null;

/**
 * @function getSocket
 * @description Get or create socket connection.
 * @param {string} token - JWT access token
 * @returns {Socket} Socket.io instance
 */
export const getSocket = (token) => {
  if (socketInstance?.connected) {
    return socketInstance;
  }

  socketInstance = io(SOCKET_URL, {
    auth: { token },
    transports:      ['websocket', 'polling'],
    timeout:          10000,
    reconnection:     true,
    reconnectionAttempts: 5,
    reconnectionDelay:    1000,
    reconnectionDelayMax: 5000,
  });

  return socketInstance;
};

/**
 * @function disconnectSocket
 * @description Disconnect socket and cleanup.
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

/**
 * @function getSocketInstance
 * @description Get current socket instance without creating new one.
 */
export const getSocketInstance = () => socketInstance;

export default { getSocket, disconnectSocket, getSocketInstance };