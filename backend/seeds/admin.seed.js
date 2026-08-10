'use strict';

const mongoose = require('mongoose');
const User = require('../models/User.model');
const GamificationProfile = require('../models/GamificationProfile.model');
const logger = require('../utils/logger');
require('dotenv').config();

/**
 * @script AdminSeeder
 * @description Create default admin user
 */

const createAdminUser = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('[Seeder] Connected to MongoDB');

    // Admin credentials
    const adminData = {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@quizai.com',
      password: 'Admin@123',  // ← Admin Password
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });

    if (existingAdmin) {
      logger.info('[Seeder] Admin user already exists');
      console.log('\n✅ Admin user already exists!');
      console.log('Email:', adminData.email);
      console.log('Password: [Already set]\n');
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create(adminData);

    // Create gamification profile for admin
    await GamificationProfile.create({
      userId: admin._id,
      totalXP: 0,
      level: 1,
      totalPoints: 0,
      badges: [],
    });

    logger.info('[Seeder] Admin user created successfully');
    
    console.log('\n✅ Admin user created successfully!');
    console.log('────────────────────────────────────');
    console.log('Email:   ', adminData.email);
    console.log('Password:', adminData.password);
    console.log('Role:    ', adminData.role);
    console.log('────────────────────────────────────\n');

    process.exit(0);

  } catch (error) {
    logger.error(`[Seeder] Error: ${error.message}`);
    console.error('\n❌ Error creating admin:', error.message, '\n');
    process.exit(1);
  }
};

// Run seeder
createAdminUser();