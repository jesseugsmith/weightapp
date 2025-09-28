import { Metadata } from 'next';
import SignUpWrapper from './SignUpWrapper';

export const metadata: Metadata = {
  title: 'Sign Up - Weight Loss Competition',
  description: 'Create your account to join weight loss competitions',
};

export default function SignUpPage() {
  return <SignUpWrapper />;
}