import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Lightweight route guard — checks for an existing JWT in localStorage.
 * If missing, redirects to /login with the intended path preserved in ?next=.
 *
 * NOTE: This is only an EXISTENCE check. The token could be expired or forged —
 * the real validation happens server-side on every protected endpoint, and any
 * 401 response from lib/api.ts will also wipe the token and redirect.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const token = localStorage.getItem("noc_jwt_token");

  if (!token) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
