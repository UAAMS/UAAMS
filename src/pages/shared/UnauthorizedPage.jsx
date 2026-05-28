import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { currentUser, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center justify-center px-4 text-sm text-slate-600">
        Checking access...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login/student" replace />;
  }

  const handleReturn = () => {
    navigate(-1);
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl text-slate-900">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          You are authenticated, but this page is restricted to another role.
        </p>
        <button
          type="button"
          onClick={handleReturn}
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-700"
        >
          Return to previous page
        </button>
      </div>
    </div>
  );
};
