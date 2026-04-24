import { LoginForm } from '@/components/auth/LoginForm';

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 p-4">
      <LoginForm />
    </div>
  );
}
