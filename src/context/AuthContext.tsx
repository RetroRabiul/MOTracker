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
  /** Emails a one-time sign-in code (and a magic link) to `email`. */
  sendEmailCode: (email: string) => Promise<void>;
  /** Completes a one-time-code sign in started by `sendEmailCode`. */
  verifyEmailCode: (email: string, token: string) => Promise<void>;
  /** Confirms a new account from the 6-digit code in the signup confirmation email. */
  verifySignupCode: (email: string, token: string) => Promise<void>;
  /** Sends the signup confirmation email again. */
  resendSignupConfirmation: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /**
   * True while a password-recovery link has established a session, meaning the
   * user may set a new password. Cleared by `updatePassword` or `logout`.
   */
  recoveryActive: boolean;
  /** Completes a recovery started by `resetPassword`. */
  updatePassword: (newPassword: string) => Promise<void>;
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

/** Where a confirmation link should land: straight into the tracker. */
const CONFIRM_REDIRECT = () => `${window.location.origin}/dashboard`;

/** Recovery links must land on the page that can actually set a new password. */
export const RESET_PASSWORD_PATH = "/reset-password";

const AUTH_CODE_MESSAGES: Record<string, string> = {
  // Supabase reports unconfirmed accounts as invalid_credentials to avoid leaking
  // which emails exist, so this message has to cover both cases.
  invalid_credentials:
    "Invalid email or password. If you just signed up, confirm your email address first.",
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
  otp_expired: "That code has expired. Request a new one.",
};

function translateAuthError(error: AuthError, fallback: string): string {
  const code = error.code;
  // `in` walks the prototype chain, so inherited keys would resolve to a
  // function rather than a message.
  if (code && Object.hasOwn(AUTH_CODE_MESSAGES, code)) {
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
  if (/token has expired or is invalid|invalid token|one-time code/i.test(message)) {
    return "That code has expired or is invalid. Request a new one.";
  }
  if (error.status === 0 || /failed to fetch|networkerror|network request failed/i.test(message)) {
    return "Network error. Check your connection and try again.";
  }

  return message || fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryActive, setRecoveryActive] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      // A recovery link establishes a session via PASSWORD_RECOVERY, which is
      // the only signal that the user is allowed to set a new password.
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryActive(true);
      } else if (event === "SIGNED_OUT") {
        setRecoveryActive(false);
      }
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
      options: {
        data: { full_name: displayName.trim() },
        emailRedirectTo: CONFIRM_REDIRECT(),
      },
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

  /**
   * Sends a one-time sign-in code. Supabase emails the code from the Magic Link
   * template, so that template must contain `{{ .Token }}`; the same email also
   * carries a magic link, which `onAuthStateChange` picks up if it is opened.
   */
  const sendEmailCode = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      throw new Error(translateAuthError(error, "Failed to send the sign-in code"));
    }
  };

  const verifyEmailCode = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: "email",
    });

    if (error) {
      throw new Error(translateAuthError(error, "That code is not valid. Request a new one."));
    }

    if (!data.user) {
      throw new Error("That code is not valid. Request a new one.");
    }

    setUser(data.user);
  };

  /**
   * Confirms a brand new account. The project has email confirmation enabled, so
   * `signup` leaves the user unconfirmed; this turns the emailed code into a session.
   */
  const verifySignupCode = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: "signup",
    });

    if (error) {
      throw new Error(translateAuthError(error, "That code is not valid. Request a new one."));
    }

    if (!data.user) {
      throw new Error("That code is not valid. Request a new one.");
    }

    setUser(data.user);
  };

  const resendSignupConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: CONFIRM_REDIRECT() },
    });

    if (error) {
      throw new Error(translateAuthError(error, "Failed to resend the confirmation email"));
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(translateAuthError(error, "Failed to sign out"));
    }
    setUser(null);
    setRecoveryActive(false);
  };

  /** Where a recovery link lands: the page that actually sets the new password. */
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
    });

    if (error) {
      throw new Error(translateAuthError(error, "Failed to send reset email"));
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      throw new Error(translateAuthError(error, "Failed to update your password"));
    }
    setRecoveryActive(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        loginWithGoogle,
        sendEmailCode,
        verifyEmailCode,
        verifySignupCode,
        resendSignupConfirmation,
        logout,
        resetPassword,
        recoveryActive,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
