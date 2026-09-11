import { io } from 'socket.io-client';

/**
 * @module socketClient
 * @description Singleton Socket.io client instance with graceful failure handling.
 */

// In development, use the proxy URL; in production, use the direct URL
const SOCKET_URL = import.meta.env.MODE === 'development'
  ? window.location.origin
  : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');

let socketInstance  = null;
let socketEnabled   = true;  // Can be reset to true on manual retry
let failureCount    = 0;
const MAX_FAILURES  = 5;     // Only permanently disable after 5 consecutive failures

/**
 * @function getSocket
 * @description Get or create socket connection with graceful error handling.
 * @param {string} token - JWT access token
 * @returns {Socket|null} Socket.io instance or null if disabled/failed
 */
export const getSocket = (token) => {
  if (!socketEnabled) {
    return null;
  }

  if (socketInstance?.connected) {
    return socketInstance;
  }

  // If socket exists but disconnected, try to reconnect first
  if (socketInstance && !socketInstance.connected) {
    socketInstance.connect();
    return socketInstance;
  }

  try {
    socketInstance = io(SOCKET_URL, {
      auth:                { token },
      transports:          ['websocket', 'polling'],
      timeout:              10000,
      reconnection:         true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
    });

    // Handle connection errors gracefully
    socketInstance.on('connect_error', (error) => {
      failureCount++;
      console.warn(
        `[Socket] Connection error (attempt ${failureCount}): ${error.message}`
      );

      // Only permanently disable after too many failures
      if (failureCount >= MAX_FAILURES) {
        console.warn('[Socket] Too many failures — disabling Socket.IO.');
        socketEnabled = false;
      }
    });

    // Reset failure count on successful connect
    socketInstance.on('connect', () => {
      failureCount = 0;
      console.log('[Socket] Connected successfully:', socketInstance.id);
    });

    return socketInstance;
  } catch (error) {
    console.warn('[Socket] Failed to create socket instance:', error.message);
    failureCount++;
    if (failureCount >= MAX_FAILURES) {
      socketEnabled = false;
    }
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
 * @function resetSocket
 * @description Re-enable socket and clear failure count (for manual retry).
 */
export const resetSocket = () => {
  socketEnabled = true;
  failureCount  = 0;
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

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

export default {
  getSocket,
  disconnectSocket,
  getSocketInstance,
  isSocketEnabled,
  resetSocket,
  setSocketEnabled,
};