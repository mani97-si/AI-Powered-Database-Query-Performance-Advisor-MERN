import React, { useState } from "react";
import { Zap, Lock, Mail, ArrowRight } from "lucide-react";

const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

export default function Auth({
  onLoginSuccess,
  authType = "user",
  initialMode = "login",
}) {
  const [isLogin, setIsLogin] =
    useState(initialMode !== "register");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = authType === "admin";

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const cleanEmail = email.trim();
      const cleanPassword = password.trim();

      if (!cleanEmail || !cleanPassword) {
        setError("Enter email and password.");
        setSubmitting(false);
        return;
      }

      /*
       * USER LOGIN / ADMIN LOGIN
       */
      if (isLogin) {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
            password: cleanPassword,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(
            data.error ||
              data.message ||
              "Invalid email or password."
          );
          return;
        }

        if (!data.token || !data.user) {
          setError("Invalid response from server.");
          return;
        }

        /*
         * ADMIN LOGIN
         *
         * Only accounts configured as admin
         * in backend are allowed here.
         */
        if (isAdmin && data.user.role !== "admin") {
          setError(
            "This account is not an admin account. Please use User Login."
          );
          return;
        }

        /*
         * USER LOGIN
         *
         * Prevent admin accounts from entering
         * through the normal user login.
         */
        if (!isAdmin && data.user.role === "admin") {
          setError(
            "Admin account detected. Please use Admin Login."
          );
          return;
        }

        // Save real JWT
        localStorage.setItem(
          "advisor_token",
          data.token
        );

        // Save complete user information
        localStorage.setItem(
          "advisor_user",
          JSON.stringify(data.user)
        );

        // Send user information to App.jsx
        onLoginSuccess(data.user);

        return;
      }

      /*
       * USER REGISTRATION
       *
       * Admin registration is not allowed.
       */
      if (isAdmin) {
        setError(
          "Admin accounts cannot be registered here."
        );
        return;
      }

      const res = await fetch(
        `${API}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
            password: cleanPassword,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(
          data.error ||
            data.message ||
            "Registration failed."
        );
        return;
      }

      if (!data.token || !data.user) {
        setError("Invalid response from server.");
        return;
      }

      // Registration always creates a normal user
      if (data.user.role === "admin") {
        setError(
          "Admin registration is not allowed."
        );
        return;
      }

      // Save JWT
      localStorage.setItem(
        "advisor_token",
        data.token
      );

      // Save user
      localStorage.setItem(
        "advisor_user",
        JSON.stringify(data.user)
      );

      // Login automatically after registration
      onLoginSuccess(data.user);
    } catch (err) {
      console.error("Authentication error:", err);

      setError(
        "Cannot reach backend server. Ensure port 5000 is active."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    if (isAdmin) return;

    setIsLogin(!isLogin);
    setError("");
    setEmail("");
    setPassword("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#1e293b",
          borderRadius: "12px",
          padding: "36px",
          width: "100%",
          maxWidth: "420px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          border: "1px solid #334155",
          color: "#f8fafc",
        }}
      >
        {/* LOGO */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              background: isAdmin
                ? "#7c3aed"
                : "#3b82f6",
              padding: "8px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={22} color="#ffffff" />
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: "20px",
            }}
          >
            QueryPilot
          </h2>
        </div>

        {/* TITLE */}
        <h3
          style={{
            margin: "0 0 8px 0",
            fontSize: "16px",
            color: "#cbd5e1",
          }}
        >
          {isAdmin
            ? "Admin Login"
            : isLogin
            ? "Sign in to your account"
            : "Create a new account"}
        </h3>

        <p
          style={{
            margin: "0 0 20px 0",
            fontSize: "13px",
            color: "#94a3b8",
          }}
        >
          {isAdmin
            ? "Access the administrator monitoring dashboard"
            : "Access the database query performance workbench"}
        </p>

        {/* ACCOUNT TYPE */}
        <div
          style={{
            background: isAdmin
              ? "#2e1065"
              : "#172554",
            border: `1px solid ${
              isAdmin ? "#6d28d9" : "#1d4ed8"
            }`,
            borderRadius: "6px",
            padding: "9px 12px",
            marginBottom: "16px",
            fontSize: "12px",
            color: isAdmin
              ? "#c4b5fd"
              : "#93c5fd",
            fontWeight: "600",
          }}
        >
          {isAdmin
            ? "🔐 Administrator Account"
            : "👤 User Account"}
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              background: "#450a0a",
              color: "#f87171",
              border: "1px solid #7f1d1d",
              borderRadius: "6px",
              padding: "10px 12px",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* EMAIL */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              Email Address
            </label>

            <div
              style={{
                position: "relative",
              }}
            >
              <Mail
                size={16}
                color="#64748b"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "12px",
                }}
              />

              <input
                type="email"
                required
                placeholder={
                  isAdmin
                    ? "admin@example.com"
                    : "name@company.com"
                }
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                style={{
                  width: "100%",
                  padding:
                    "10px 12px 10px 38px",
                  borderRadius: "6px",
                  background: "#0f172a",
                  border: "1px solid #475569",
                  color: "#ffffff",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              Password
            </label>

            <div
              style={{
                position: "relative",
              }}
            >
              <Lock
                size={16}
                color="#64748b"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "12px",
                }}
              />

              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                style={{
                  width: "100%",
                  padding:
                    "10px 12px 10px 38px",
                  borderRadius: "6px",
                  background: "#0f172a",
                  border: "1px solid #475569",
                  color: "#ffffff",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: "8px",
              padding: "11px",
              background: isAdmin
                ? "#7c3aed"
                : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: submitting
                ? "not-allowed"
                : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting
              ? "Processing..."
              : isAdmin
              ? "Admin Sign In"
              : isLogin
              ? "Sign In"
              : "Register Account"}

            <ArrowRight size={16} />
          </button>
        </form>

        {/* USER SIGNUP / SIGNIN */}
        {!isAdmin && (
          <div
            style={{
              marginTop: "20px",
              textAlign: "center",
              fontSize: "13px",
              color: "#94a3b8",
            }}
          >
            {isLogin
              ? "Don't have an account? "
              : "Already have an account? "}

            <span
              onClick={switchMode}
              style={{
                color: "#60a5fa",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              {isLogin
                ? "Sign up"
                : "Sign in"}
            </span>
          </div>
        )}

        {/* ADMIN INFORMATION */}
        {isAdmin && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px",
              background: "#1e1b4b",
              border: "1px solid #4338ca",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#a5b4fc",
              lineHeight: "1.5",
            }}
          >
            Only the two administrator accounts
            configured in the backend can access
            the admin dashboard.
          </div>
        )}

        {/* USER INFORMATION */}
        {!isAdmin && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#64748b",
              lineHeight: "1.5",
            }}
          >
            Each user has a separate query history
            and generated report history.
          </div>
        )}
      </div>
    </div>
  );
}