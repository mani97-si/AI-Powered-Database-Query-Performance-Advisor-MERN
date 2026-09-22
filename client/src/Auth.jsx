import React, { useState } from "react";
import { Zap, Lock, Mail, ArrowRight } from "lucide-react";

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.ok) {
        localStorage.setItem("advisor_token", data.token);
        localStorage.setItem("advisor_user", data.email);
        onLoginSuccess(data.email);
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err) {
      setError("Cannot reach backend server. Ensure port 5000 is active.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0f172a",
      padding: "20px"
    }}>
      <div style={{
        background: "#1e293b",
        borderRadius: "12px",
        padding: "36px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        border: "1px solid #334155",
        color: "#f8fafc"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <div style={{
            background: "#3b82f6",
            padding: "8px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Zap size={22} color="#ffffff" />
          </div>
          <h2 style={{ margin: 0, fontSize: "20px" }}>QueryPilot</h2>
        </div>

        <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#cbd5e1" }}>
          {isLogin ? "Sign in to your account" : "Create a new account"}
        </h3>
        <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#94a3b8" }}>
          Access the database query performance workbench
        </p>

        {error && (
          <div style={{
            background: "#450a0a",
            color: "#f87171",
            border: "1px solid #7f1d1d",
            borderRadius: "6px",
            padding: "10px 12px",
            fontSize: "13px",
            marginBottom: "16px"
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={16} color="#64748b" style={{ position: "absolute", left: "12px", top: "12px" }} />
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  borderRadius: "6px",
                  background: "#0f172a",
                  border: "1px solid #475569",
                  color: "#ffffff",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={16} color="#64748b" style={{ position: "absolute", left: "12px", top: "12px" }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  borderRadius: "6px",
                  background: "#0f172a",
                  border: "1px solid #475569",
                  color: "#ffffff",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: "8px",
              padding: "11px",
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            {submitting ? "Processing..." : (isLogin ? "Sign In" : "Register Account")}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            style={{ color: "#60a5fa", cursor: "pointer", fontWeight: "600" }}
          >
            {isLogin ? "Sign up" : "Sign in"}
          </span>
        </div>
      </div>
    </div>
  );
}