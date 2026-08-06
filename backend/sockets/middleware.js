'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User.model');

/**
 * @module socketAuthMiddleware
 * @description JWT authentication middleware for Socket.io connections.
 * Validates token passed in handshake auth or query.
 */

const socketAuthMiddleware = async (socket, next) => {
  try {
    // Token from handshake auth or query parameter
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1] ||
      socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required for socket connection'));
    }

    const decoded = jwt.verify(token, config.JWT.ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('_id firstName lastName role isActive');

    if (!user || !user.isActive) {
      return next(new Error('Invalid user or account deactivated'));
    }

    // Attach user info to socket
    socket.userId = user._id.toString();
    socket.userRole = user.role;
    socket.userName = `${user.firstName} ${user.lastName}`;

    next();
  } catch (error) {
    next(new Error('Socket authentication failed'));
  }
};

module.exports = { socketAuthMiddleware };