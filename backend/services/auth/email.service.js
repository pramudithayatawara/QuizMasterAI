'use strict';

const nodemailer = require('nodemailer');
const config = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * @service EmailService
 * @description Handles all email communications.
 * Password reset, welcome emails, notifications.
 */

class EmailService {
  constructor() {
    this.transporter = this._createTransporter();
  }

  /**
   * @private _createTransporter
   */
  _createTransporter() {
    // Check if email is configured
    if (!config.EMAIL.USER || !config.EMAIL.PASS) {
      logger.warn('Email service not configured - emails will be disabled');
      return null;
    }

    return nodemailer.createTransport({
      host: config.EMAIL.HOST,
      port: config.EMAIL.PORT,
      secure: config.EMAIL.PORT === 465,
      auth: {
        user: config.EMAIL.USER,
        pass: config.EMAIL.PASS,
      },
      tls: {
        rejectUnauthorized: config.IS_PRODUCTION,
      },
    });
  }

  /**
   * @method sendEmail
   * @description Core email sending method.
   */
  async sendEmail({ to, subject, html, text }) {
    // If transporter is not configured, just log and return
    if (!this.transporter) {
      logger.warn(`Email service not configured - skipping email to ${to}`);
      return null;
    }

    try {
      const mailOptions = {
        from: config.EMAIL.FROM,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId} to ${to}`);
      return info;
    } catch (error) {
      logger.error(`Email failed to ${to}: ${error.message}`);
      throw new Error('Failed to send email. Please try again later.');
    }
  }

  /**
   * @method sendPasswordResetEmail
   * @description Send password reset link to user.
   */
  async sendPasswordResetEmail(user, resetToken) {
    const resetURL = `${config.FRONTEND_URL}/reset-password/${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .body { padding: 40px; }
          .body p { color: #555; line-height: 1.6; font-size: 16px; }
          .btn { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 6px; color: #856404; font-size: 14px; }
          .footer { padding: 20px 40px; background: #f8f9fa; text-align: center; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="body">
            <p>Hello <strong>${user.firstName}</strong>,</p>
            <p>We received a request to reset your password for your <strong>RAG Quiz System</strong> account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center;">
              <a href="${resetURL}" class="btn">Reset My Password</a>
            </div>
            <div class="warning">
              ⚠️ This link will expire in <strong>1 hour</strong>. If you didn't request this, please ignore this email.
            </div>
            <p style="color: #999; font-size: 13px; margin-top: 20px;">
              If the button doesn't work, copy and paste this link:<br>
              <a href="${resetURL}" style="color: #667eea;">${resetURL}</a>
            </p>
          </div>
          <div class="footer">
            <p>RAG Quiz System | Rajarata University of Sri Lanka</p>
            <p>This email was sent to ${user.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: user.email,
      subject: '🔐 Password Reset Request - RAG Quiz System',
      html,
    });
  }

  /**
   * @method sendWelcomeEmail
   * @description Send welcome email to new user.
   */
  async sendWelcomeEmail(user) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .body { padding: 40px; }
          .body p { color: #555; line-height: 1.6; font-size: 16px; }
          .feature { display: flex; align-items: center; margin: 12px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; }
          .feature span { font-size: 24px; margin-right: 12px; }
          .btn { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #11998e, #38ef7d); color: white; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 20px 0; }
          .footer { padding: 20px 40px; background: #f8f9fa; text-align: center; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to RAG Quiz!</h1>
          </div>
          <div class="body">
            <p>Hello <strong>${user.firstName}</strong>! 👋</p>
            <p>Your account has been created successfully. Welcome to the <strong>RAG-Based Intelligent Adaptive Quiz Generation System</strong>!</p>
            <p>Here's what you can do:</p>
            <div class="feature"><span>📄</span><div><strong>Upload PDFs</strong> - Upload your study materials</div></div>
            <div class="feature"><span>🤖</span><div><strong>AI Quiz Generation</strong> - Get personalized quizzes</div></div>
            <div class="feature"><span>📊</span><div><strong>Track Progress</strong> - Monitor your performance</div></div>
            <div class="feature"><span>⚔️</span><div><strong>Battle Mode</strong> - Compete with others</div></div>
            <div class="feature"><span>🏆</span><div><strong>Leaderboard</strong> - Earn badges and rank up</div></div>
            <div style="text-align: center;">
              <a href="${config.FRONTEND_URL}/login" class="btn">Start Learning Now</a>
            </div>
          </div>
          <div class="footer">
            <p>RAG Quiz System | Rajarata University of Sri Lanka</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: user.email,
      subject: '🎉 Welcome to RAG Quiz System!',
      html,
    });
  }

  /**
   * @method sendPasswordChangedEmail
   */
  async sendPasswordChangedEmail(user) {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 40px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px;">
          <h2 style="color: #333;">🔒 Password Changed Successfully</h2>
          <p>Hello <strong>${user.firstName}</strong>,</p>
          <p>Your password has been changed successfully on <strong>${new Date().toLocaleString()}</strong>.</p>
          <p style="background: #fff3cd; padding: 12px; border-radius: 6px; color: #856404;">
            ⚠️ If you did not make this change, please contact support immediately.
          </p>
          <p style="color: #999; font-size: 12px;">RAG Quiz System Security Team</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: user.email,
      subject: '🔒 Password Changed - RAG Quiz System',
      html,
    });
  }
}

module.exports = new EmailService();