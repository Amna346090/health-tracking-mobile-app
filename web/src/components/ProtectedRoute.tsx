import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './Spinner';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="center-screen"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
