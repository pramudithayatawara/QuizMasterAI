import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import { authAPI } from '../../api/auth.api.js';

const RegisterForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Backend exact regex pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  const registerSchema = z
    .object({
      firstName: z
        .string()
        .min(2, 'First name must be 2-50 characters')
        .max(50, 'First name must be 2-50 characters')
        .regex(/^[a-zA-Z\s]+$/, 'First name can only contain letters'),
      lastName: z
        .string()
        .min(2, 'Last name must be 2-50 characters')
        .max(50, 'Last name must be 2-50 characters')
        .regex(/^[a-zA-Z\s]+$/, 'Last name can only contain letters'),
      email: z.string().email('Please provide a valid email address'),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password cannot exceed 128 characters')
        .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Must contain at least one number')
        .regex(/[@$!%*?&]/, 'Must contain special character (@$!%*?&)'),
      confirmPassword: z.string().min(1, 'Confirm password is required'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);

    try {
      // Backend authValidator එකට අවශ්‍ය සියලුම data (confirmPassword ඇතුළුව) යවයි
      await authAPI.register(data);

      // Registration සාර්ථක වූ පසු Login Page එකට Redirect කරයි
      navigate('/login');
    } catch (err) {
      // Backend එකෙන් එන Exact Error message (Array එකේ පළමු එක) UI එකට පෙන්වීම
      const backendErrors = err.response?.data?.errors;
      if (backendErrors && backendErrors.length > 0) {
        setError(backendErrors[0].message);
      } else {
        setError(
          err.response?.data?.message || err.message || 'Registration failed. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Error Alert Box */}
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-100 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      {/* First Name Field */}
      <Input
        label="First Name"
        type="text"
        placeholder="John"
        {...register('firstName')}
        error={errors.firstName?.message}
      />

      {/* Last Name Field */}
      <Input
        label="Last Name"
        type="text"
        placeholder="Doe"
        {...register('lastName')}
        error={errors.lastName?.message}
      />

      {/* Email Field */}
      <Input
        label="Email"
        type="email"
        placeholder="john@example.com"
        {...register('email')}
        error={errors.email?.message}
      />

      {/* Password Field */}
      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        {...register('password')}
        error={errors.password?.message}
      />

      {/* Confirm Password Field */}
      <Input
        label="Confirm Password"
        type="password"
        placeholder="••••••••"
        {...register('confirmPassword')}
        error={errors.confirmPassword?.message}
      />

      {/* Submit Button */}
      <Button type="submit" isLoading={loading} className="w-full">
        Register
      </Button>
    </form>
  );
};

export default RegisterForm;