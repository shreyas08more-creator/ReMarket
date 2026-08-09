import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import type { UserRole } from '../lib/supabase';

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: UserRole }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="h-10 w-10 rounded-full border-4 border-eco-200 border-t-eco-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (role && profile && profile.user_type !== role) {
    const dest = profile.user_type === 'vendor' ? '/vendor/dashboard' : '/customer/dashboard';
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}
