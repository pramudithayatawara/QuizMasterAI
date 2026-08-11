import { io } from 'socket.io-client';

/**
 * @module socketClient
 * @description Singleton Socket.io client instance with graceful failure handling.
 */

// In development, use the proxy URL; in production, use the direct URL
const SOCKET_URL = import.meta.env.MODE === 'development' 
  ? window.location.origin 
  : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');

let socketInstance = null;
let socketEnabled = true; // Flag to disable socket if backend doesn't support it

/**
 * @function getSocket
 * @description Get or create socket connection with graceful error handling.
 * @param {string} token - JWT access token
 * @returns {Socket|null} Socket.io instance or null if disabled/failed
 */
export const getSocket = (token) => {
  if (!socketEnabled) {
    console.log('[Socket] Socket.IO is disabled');
    return null;
  }

  if (socketInstance?.connected) {
    return socketInstance;
  }

  try {
    socketInstance = io(SOCKET_URL, {
      auth: { token },
      transports:      ['websocket', 'polling'],
      timeout:          10000,
      reconnection:     true,
      reconnectionAttempts: 5,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
    });

    // Handle connection errors gracefully
    socketInstance.on('connect_error', (error) => {
      console.warn('[Socket] Connection failed, disabling Socket.IO:', error.message);
      socketEnabled = false;
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
    });

    return socketInstance;
  } catch (error) {
    console.warn('[Socket] Failed to create socket instance:', error.message);
    socketEnabled = false;
    return null;
  }
};

/**
 * @function disconnectSocket
 * @description Disconnect socket and cleanup.
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    try {
      socketInstance.disconnect();
    } catch (error) {
      console.warn('[Socket] Error during disconnect:', error.message);
    }
    socketInstance = null;
  }
};

/**
 * @function getSocketInstance
 * @description Get current socket instance without creating new one.
 * @returns {Socket|null} Current socket instance or null
 */
export const getSocketInstance = () => socketInstance;

/**
 * @function isSocketEnabled
 * @description Check if Socket.IO is enabled.
 * @returns {boolean} True if Socket.IO is enabled
 */
export const isSocketEnabled = () => socketEnabled;

/**
 * @function setSocketEnabled
 * @description Enable or disable Socket.IO.
 * @param {boolean} enabled - Whether to enable Socket.IO
 */
export const setSocketEnabled = (enabled) => {
  socketEnabled = enabled;
  if (!enabled && socketInstance) {
    disconnectSocket();
  }
};

export default { getSocket, disconnectSocket, getSocketInstance, isSocketEnabled, setSocketEnabled };