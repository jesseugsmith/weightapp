'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import LoadingSpinner from '@/components/LoadingSpinner';

const SignUpForm = dynamic(() => import('./SignUpForm'), {
  ssr: false,
});

export default function SignUpWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading sign up form..." />}>
      <SignUpForm />
    </Suspense>
  );
}
