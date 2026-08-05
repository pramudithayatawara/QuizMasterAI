'use strict';

/**
 * @module roles
 * @description User role constants used across the system.
 */

const ROLES = Object.freeze({
  ADMIN: 'admin',
  USER: 'user',
});

const ROLE_LIST = Object.values(ROLES);

module.exports = { ROLES, ROLE_LIST };