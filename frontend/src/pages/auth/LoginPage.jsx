import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, Brain, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { ROUTES } from '../../constants/routes.js';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';

// ─── Validation Schema ────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * @page LoginPage
 * @description User login form with JWT authentication.
 */
const LoginPage = () => {
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email:    '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    await login(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-dark-50">Welcome back</h1>
        <p className="text-dark-400">
          Sign in to continue your learning journey
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          leftIcon={<User size={16} />}
          required
          {...register('email')}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter your password"
          error={errors.password?.message}
          leftIcon={<ShieldCheck size={16} />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-dark-400 hover:text-dark-200 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
          required
          {...register('password')}
        />

        {/* Forgot Password */}
        <div className="flex justify-end">
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className="w-full"
        >
          Sign In
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-dark-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-dark-950 text-dark-400">
            Don't have an account?
          </span>
        </div>
      </div>

      {/* Register Link */}
      <Link to={ROUTES.REGISTER}>
        <Button variant="secondary" size="lg" className="w-full">
          Create Account
        </Button>
      </Link>
    </div>
  );
};

export default LoginPage;