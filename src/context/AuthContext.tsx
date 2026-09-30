import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthError, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Thrown by `signup` when the project requires email confirmation. */
export const EMAIL_CONFIRMATION_MESSAGE = "Check your email to confirm your account";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

/** `user_metadata.full_name` (set at sign up / by Google) with an email fallback. */
export function getDisplayName(user: User | null): string {
  const fullName = user?.user_metadata?.["full_name"];
  if (typeof fullName === "string" && fullName.trim().length > 0) {
    return fullName.trim();
  }
  return user?.email ? user.email.split("@")[0] : "";
}

const AUTH_CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid email or password",
  over_request_rate_limit: "Too many attempts. Please try again later",
  over_email_send_rate_limit: "Too many attempts. Please try again later",
  email_not_confirmed: "Please confirm your email address before signing in",
  user_already_exists: "An account with this email already exists",
  email_exists: "An account with this email already exists",
  weak_password: "Password is too weak. Use at least 6 characters",
  email_address_invalid: "Please enter a valid email address",
  signup_disabled: "Email sign up is disabled on this project",
  email_provider_disabled: "Email sign up is disabled on this project",
  provider_disabled: "This sign in provider is disabled",
  oauth_provider_not_supported: "This sign in provider is not supported",
  request_timeout: "Network error. Check your connection and try again.",
};

function translateAuthError(error: AuthError, fallback: string): string {
  const code = error.code;
  if (code && code in AUTH_CODE_MESSAGES) {
    return AUTH_CODE_MESSAGES[code];
  }

  const message = error.message || "";

  if (error.status === 429 || /rate limit|too many requests/i.test(message)) {
    return "Too many attempts. Please try again later";
  }
  if (/invalid login credentials/i.test(message)) return "Invalid email or password";
  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email address before signing in";
  }
  if (/already registered|already been registered|already exists/i.test(message)) {
    return "An account with this email already exists";
  }
  if (/password should be at least|weak password|too weak/i.test(message)) {
    return "Password is too weak. Use at least 6 characters";
  }
  if (/unable to validate email|invalid email/i.test(message)) {
    return "Please enter a valid email address";
  }
  if (/sign ?ups? (not allowed|are disabled|is disabled)/i.test(message)) {
    return "Email sign up is disabled on this project";
  }
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return "This sign in provider is disabled";
  }
  if (error.status === 0 || /failed to fetch|networkerror|network request failed/i.test(message)) {
    return "Network error. Check your connection and try again.";
  }

  return message || fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error(translateAuthError(error, "Failed to sign in"));
    }

    setUser(data.user);
  };

  const signup = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: displayName.trim() } },
    });

    if (error) {
      throw new Error(translateAuthError(error, "Failed to create account"));
    }

    if (!data.session) {
      throw new Error(EMAIL_CONFIRMATION_MESSAGE);
    }

    setUser(data.user);
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (error) {
      throw new Error(translateAuthError(error, "Google sign-in failed. Try again or use email/password."));
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(translateAuthError(error, "Failed to sign out"));
    }
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });

    if (error) {
      throw new Error(translateAuthError(error, "Failed to send reset email"));
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, loginWithGoogle, logout, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}
