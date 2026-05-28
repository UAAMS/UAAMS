import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const RoleRoute = ({ allowedRoles = [] }) => {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
