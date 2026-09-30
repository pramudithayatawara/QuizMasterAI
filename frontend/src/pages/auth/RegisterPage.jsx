import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User, UserCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { ROUTES } from '../../constants/routes.js';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';

const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName:  z.string().min(2, 'Last name must be at least 2 characters'),
  email:     z.string().email('Enter a valid email address'),
  password:  z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
});

/**
 * @page RegisterPage
 * @description User registration form.
 */
const RegisterPage = () => {
  const { register: registerUser, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    const { confirmPassword, firstName, lastName, email, password } = data;

    // Generate username from firstName and lastName (lowercase, no spaces)
    const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}`;

    // Prepare registration data with username (backend requires username, email, password)
    const registerData = {
      username,
      email,
      password,
    };

    await registerUser(registerData);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-dark-50">Create account</h1>
        <p className="text-dark-400">Join thousands of learners on QuizAI</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            placeholder="John"
            error={errors.firstName?.message}
            leftIcon={<UserCircle size={16} />}
            required
            {...register('firstName')}
          />
          <Input
            label="Last Name"
            placeholder="Doe"
            error={errors.lastName?.message}
            leftIcon={<UserCircle size={16} />}
            required
            {...register('lastName')}
          />
        </div>

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
          placeholder="Min 8 chars, uppercase, number"
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

        <Input
          label="Confirm Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Repeat your password"
          error={errors.confirmPassword?.message}
          leftIcon={<ShieldCheck size={16} />}
          required
          {...register('confirmPassword')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className="w-full"
        >
          Create Account
        </Button>
      </form>

      <div className="text-center text-sm text-dark-400">
        Already have an account?{' '}
        <Link
          to={ROUTES.LOGIN}
          className="text-primary-400 hover:text-primary-300 font-medium"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
};

export default RegisterPage;