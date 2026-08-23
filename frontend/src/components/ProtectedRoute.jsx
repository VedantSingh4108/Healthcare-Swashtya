import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('jwt');
  const userStr = localStorage.getItem('user');
  const location = useLocation();

  if (!token || !userStr) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  try {
    const user = JSON.parse(userStr);
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Redirect to their respective dashboard if they try to access unauthorized routes
      if (user.role === 'PATIENT') return <Navigate to="/patient" replace />;
      if (user.role === 'DOCTOR') return <Navigate to="/doctor" replace />;
      if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    }
  } catch (e) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
