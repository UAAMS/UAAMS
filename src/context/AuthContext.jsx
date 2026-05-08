import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getStoredToken, setStoredToken } from "../lib/apiClient";
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  refreshRealtimeSocket,
} from "../lib/socketClient";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const token = getStoredToken();
      if (!token) {
        if (isMounted) {
          setAuthLoading(false);
        }
        return;
      }

      try {
        const response = await api.get("/auth/me", { token });
        if (!isMounted) return;
        setCurrentUser(response?.data?.user || null);
        connectRealtimeSocket();
      } catch {
        setStoredToken("");
        if (isMounted) {
          setCurrentUser(null);
        }
        disconnectRealtimeSocket();
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async ({ identifier, password, role, rememberMe = true }) => {
    try {
      const response = await api.post(
        "/auth/login",
        { identifier, password, role },
        { token: "" },
      );
      const token = response?.data?.token || "";
      const user = response?.data?.user || null;

      if (!token || !user) {
        return {
          ok: false,
          message: "Invalid response received from server.",
        };
      }

      setStoredToken(token, { rememberMe });
      setCurrentUser(user);
      refreshRealtimeSocket();

      return {
        ok: true,
        message: response?.message || "Login successful.",
        user,
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "Unable to login right now.",
      };
    }
  };

  const register = async (payload) => {
    try {
      const response = await api.post("/auth/register", payload, { token: "" });
      return {
        ok: true,
        message: response?.message || "Account created successfully.",
        data: response?.data || {},
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "Unable to register right now.",
      };
    }
  };

  const verifyEmail = async (token) => {
    try {
      const response = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
        token: "",
      });
      return {
        ok: true,
        message: response?.message || "Email verified successfully.",
        data: response?.data || {},
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "Unable to verify email.",
      };
    }
  };

  const resendVerificationEmail = async (email) => {
    try {
      const response = await api.post(
        "/auth/verify-email/resend",
        { email },
        { token: "" },
      );
      return {
        ok: true,
        message: response?.message || "Verification link sent.",
        data: response?.data || {},
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "Unable to resend verification email.",
      };
    }
  };

  const requestPasswordResetOtp = async (email) => {
    try {
      const response = await api.post(
        "/auth/forgot-password/request-otp",
        { email },
        { token: "" },
      );
      return {
        ok: true,
        message: response?.message || "OTP sent to your registered email.",
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "Unable to send OTP right now.",
      };
    }
  };

  const verifyPasswordResetOtp = async ({ email, otp }) => {
    try {
      const response = await api.post(
        "/auth/forgot-password/verify-otp",
        { email, otp },
        { token: "" },
      );
      return {
        ok: true,
        message: response?.message || "OTP verified successfully.",
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "Invalid OTP.",
      };
    }
  };

  const resetPasswordWithOtp = async ({ email, otp, newPassword, confirmPassword }) => {
    try {
      const response = await api.post(
        "/auth/forgot-password/reset",
        { email, otp, newPassword, confirmPassword },
        { token: "" },
      );
      return {
        ok: true,
        message: response?.message || "Password reset successful.",
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "Unable to reset password.",
      };
    }
  };

  const logout = () => {
    const role = currentUser?.role;
    setStoredToken("");
    setCurrentUser(null);
    disconnectRealtimeSocket();

    const redirectByRole = {
      student: "/login/student",
      university: "/login/university",
      blogger: "/login/blogger",
      admin: "/login/admin",
    };

    if (role && redirectByRole[role]) {
      window.location.href = redirectByRole[role];
      return;
    }

    const pathname = window.location.pathname;
    if (pathname === "/student" || pathname.startsWith("/student/")) {
      window.location.href = "/login/student";
    } else if (pathname === "/university" || pathname.startsWith("/university/")) {
      window.location.href = "/login/university";
    } else if (pathname === "/blogger" || pathname.startsWith("/blogger/")) {
      window.location.href = "/login/blogger";
    } else if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      window.location.href = "/login/admin";
    }
  };

  const refreshUser = async () => {
    const token = getStoredToken();
    if (!token) return null;

    try {
      const response = await api.get("/auth/me", { token });
      const user = response?.data?.user || null;
      setCurrentUser(user);
      if (user) {
        connectRealtimeSocket();
      } else {
        disconnectRealtimeSocket();
      }
      return user;
    } catch {
      disconnectRealtimeSocket();
      return null;
    }
  };

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: Boolean(currentUser),
      authLoading,
      login,
      register,
      verifyEmail,
      resendVerificationEmail,
      requestPasswordResetOtp,
      verifyPasswordResetOtp,
      resetPasswordWithOtp,
      logout,
      refreshUser,
    }),
    [currentUser, authLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
