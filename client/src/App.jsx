import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  FileText,
  Gauge,
  HelpCircle,
  KeyRound,
  Layers,
  LogOut,
  Mail,
  MessageSquare,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  TriangleAlert,
  Users,
  Wand2,
  Zap,
} from "lucide-react";

const API =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000/api"
    : "https://ai-powered-database-query-performance.onrender.com/api";

// ---------------- HELPERS ---------------- //

const getDisplayName = (val) => {
  if (!val) return "User";
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return parsed.email || parsed.username || parsed.id || val;
    } catch {
      return val;
    }
  }
  return val.email || val.username || "User";
};

const getStorageKey = (prefix, currentUser) => {
  const user = getDisplayName(currentUser);
  return `${prefix}_${String(user).toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
};

const getToken = () => {
  try {
    return localStorage.getItem("advisor_token") || "";
  } catch {
    return "";
  }
};

const getRole = () => {
  try {
    return localStorage.getItem("advisor_role") || "user";
  } catch {
    return "user";
  }
};

// fetch wrapper that ALWAYS attaches the JWT to backend requests
const authFetch = (url, options = {}) => {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

const SAMPLE_DEFAULT = `SELECT *
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE LOWER(c.email) LIKE '%gmail.com'
  AND o.status = 'completed'
ORDER BY o.created_at DESC;`;

const SAMPLE_EXPLAINABLE = `SELECT u.id, u.username, o.total_amount
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE LOWER(u.email) LIKE '%@company.org'
  AND o.status != 'cancelled'
ORDER BY o.created_at DESC;`;

const SAMPLE_DBA = `SELECT customer_id, COUNT(order_id) AS total_orders, SUM(amount) AS revenue
FROM orders
WHERE status = 'PENDING'
  AND created_at >= '2026-01-01'
GROUP BY customer_id
HAVING revenue > 5000
ORDER BY revenue DESC;`;

const SAMPLE_MEDIUM = `SELECT customer_id, COUNT(*) AS total_items, SUM(price) AS total_spent
FROM transactions
WHERE transaction_date >= '2026-01-01'
GROUP BY customer_id
ORDER BY total_spent DESC;`;

const SAMPLE_SUBQUERY = `SELECT id, name, email 
FROM customers 
WHERE id IN (
  SELECT customer_id 
  FROM orders 
  WHERE total_amount > 1000
)
ORDER BY created_at DESC;`;

// ---------------- APP ---------------- //

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return localStorage.getItem("advisor_token") ? localStorage.getItem("advisor_user") || null : null;
    } catch {
      return null;
    }
  });

  const [userRole, setUserRole] = useState(getRole);
  const [showAuth, setShowAuth] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState("login");
  const [activeTab, setActiveTab] = useState("workbench");
  const [sql, setSql] = useState(SAMPLE_DEFAULT);
  const [report, setReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ total: 0, averageScore: 0, highRisk: 0 });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminReports, setAdminReports] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [health, setHealth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const handleLogout = () => {
    try {
      localStorage.removeItem("advisor_token");
      localStorage.removeItem("advisor_user");
      localStorage.removeItem("advisor_role");
    } catch (e) {}
    setCurrentUser(null);
    setUserRole("user");
    setReport(null);
    setReports([]);
    setStats({ total: 0, averageScore: 0, highRisk: 0 });
    setAdminUsers([]);
    setAdminReports([]);
    setAdminStats(null);
    setShowAuth(false);
    setActiveTab("workbench");
  };

  const loadReportsAndStats = async () => {
    if (!currentUser) return;
    const userParam = encodeURIComponent(getDisplayName(currentUser));
    const localReportsKey = getStorageKey("advisor_reports", currentUser);
    const localStatsKey = getStorageKey("advisor_stats", currentUser);

    let localReports = [];
    let localStats = { total: 0, averageScore: 0, highRisk: 0 };

    try {
      const storedReports = localStorage.getItem(localReportsKey);
      if (storedReports) {
        const parsed = JSON.parse(storedReports);
        if (Array.isArray(parsed)) localReports = parsed;
      }
    } catch {
      localStorage.removeItem(localReportsKey);
    }

    try {
      const storedStats = localStorage.getItem(localStatsKey);
      if (storedStats) {
        const parsed = JSON.parse(storedStats);
        if (parsed && typeof parsed === "object") localStats = parsed;
      }
    } catch {
      localStorage.removeItem(localStatsKey);
    }

    setReports(localReports);
    setStats(localStats);

    try {
      setRefreshing(true);
      const [resReports, resStats] = await Promise.all([
        authFetch(`${API}/reports?userEmail=${userParam}`),
        authFetch(`${API}/stats?userEmail=${userParam}`),
      ]);

      if (resReports.status === 401 || resStats.status === 401) {
        handleLogout();
        return;
      }

      const dataReports = await resReports.json();
      const dataStats = await resStats.json();

      if (dataReports && dataReports.ok && Array.isArray(dataReports.reports)) {
        setReports(dataReports.reports);
        try {
          localStorage.setItem(localReportsKey, JSON.stringify(dataReports.reports));
        } catch (e) {}
      }
      if (dataStats && dataStats.ok) {
        setStats(dataStats);
        try {
          localStorage.setItem(localStatsKey, JSON.stringify(dataStats));
        } catch (e) {}
      }
    } catch (err) {
      console.warn("Backend sync skipped; using local store.");
    } finally {
      setRefreshing(false);
    }
  };

  const loadAdminData = async () => {
    if (userRole !== "admin") return;
    setRefreshing(true);
    try {
      const [resUsers, resReports, resStats] = await Promise.all([
        authFetch(`${API}/admin/users`),
        authFetch(`${API}/admin/reports?limit=100`),
        authFetch(`${API}/admin/stats`),
      ]);

      if (resUsers.status === 401 || resUsers.status === 403) {
        alert("Admin session expired or access denied.");
        return;
      }

      const dataUsers = await resUsers.json();
      const dataReports = await resReports.json();
      const dataStats = await resStats.json();

      if (dataUsers?.ok) setAdminUsers(dataUsers.users || []);
      if (dataReports?.ok) setAdminReports(dataReports.reports || []);
      if (dataStats?.ok) setAdminStats(dataStats);
    } catch (err) {
      console.warn("Failed to load admin data:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateAdminReport = async () => {
    setGeneratingReport(true);
    try {
      let r = null;
      try {
        const res = await authFetch(`${API}/admin/generate-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Enterprise Database Performance & User Audit Report" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok && data.report) {
            r = data.report;
          }
        }
      } catch (err) {}

      if (!r) {
        const totalReports = adminReports.length;
        const totalUsers = adminUsers.length;
        const avgScore = totalReports
          ? Math.round(
              adminReports.reduce((sum, rep) => sum + Number(rep.analysis?.performanceScore || 0), 0) / totalReports
            )
          : 0;

        const bottleneckCounts = {};
        adminReports.forEach((rep) => {
          (rep.analysis?.findings || []).forEach((f) => {
            bottleneckCounts[f.title] = (bottleneckCounts[f.title] || 0) + 1;
          });
        });

        r = {
          title: "Enterprise Database Performance & User Audit Report",
          generatedBy: getDisplayName(currentUser),
          generatedAt: new Date(),
          metrics: {
            totalUsers,
            totalQueriesAnalyzed: totalReports,
            averageSystemScore: avgScore,
            riskDistribution: {
              high: adminReports.filter((rep) => rep.analysis?.riskLevel === "High").length,
              medium: adminReports.filter((rep) => rep.analysis?.riskLevel === "Medium").length,
              low: adminReports.filter((rep) => rep.analysis?.riskLevel === "Low").length,
            },
          },
          topBottlenecks: Object.entries(bottleneckCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([title, count]) => ({ title, count })),
          userBreakdown: adminUsers.map((u) => ({
            email: u.email,
            queriesSubmitted: u.totalQueries || 0,
            avgScore: u.averageScore || 0,
            highRiskCount: u.highRiskQueries || 0,
          })),
          recommendations: [
            "Create covering composite indexes on tables targeted by high-frequency user WHERE clauses.",
            "Educate development teams on replacing SELECT * with explicit column projections.",
            "Wrap case-insensitive string predicates with indexed functional columns or collations to avoid non-sargable scans.",
            "Add pagination limits to high-risk sorting queries.",
          ],
        };
      }
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = 35;

      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 24, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text("QueryPilot - Admin Executive Audit", margin, 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Generated by: ${r.generatedBy} | ${new Date(r.generatedAt).toLocaleString()}`, margin, 18);

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Users: ${r.metrics.totalUsers}`, margin + 5, y + 8);
      doc.text(`Queries Executed: ${r.metrics.totalQueriesAnalyzed}`, margin + 55, y + 8);
      doc.text(`System Avg Score: ${r.metrics.averageSystemScore}/100`, margin + 115, y + 8);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Risk Distribution: High: ${r.metrics.riskDistribution.high} | Medium: ${r.metrics.riskDistribution.medium} | Low: ${r.metrics.riskDistribution.low}`,
        margin + 5,
        y + 17
      );
      y += 32;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("Top Detected Query Bottlenecks:", margin, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      (r.topBottlenecks || []).forEach((b) => {
        doc.text(`• ${b.title} (Observed ${b.count} times)`, margin + 2, y);
        y += 5;
      });

      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("User Workload Summary:", margin, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      (r.userBreakdown || []).forEach((u) => {
        doc.text(`• ${u.email}: ${u.queriesSubmitted} queries | Avg Score: ${u.avgScore}/100 | High Risk: ${u.highRiskCount}`, margin + 2, y);
        y += 5;
      });

      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("System Recommendations:", margin, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      (r.recommendations || []).forEach((rec, idx) => {
        doc.text(`${idx + 1}. ${rec}`, margin + 2, y);
        y += 5;
      });

      doc.save(`admin-audit-report-${Date.now()}.pdf`);
      alert("Executive System Audit Report generated and downloaded successfully!");
      loadAdminData();
    } catch (e) {
      alert("Error generating administrative report.");
    } finally {
      setGeneratingReport(false);
    }
  };

  const checkHealth = async () => {
    try {
      const r = await fetch(`${API}/health`);
      const d = await r.json();
      setHealth(!!d.mongodb);
    } catch (err) {
      setHealth(false);
    }
  };

  const analyze = async () => {
    if (!sql.trim()) return alert("Enter an SQL query.");
    setLoading(true);
    setCopied(false);
    try {
      const r = await authFetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "SQL Performance Analysis",
          sql: sql,
          userEmail: getDisplayName(currentUser),
        }),
      });

      if (r.status === 401) {
        alert("Your session is invalid or expired. Please sign in again.");
        handleLogout();
        return;
      }

      const d = await r.json();
      if (d.ok) {
        setReport(d.report);

        try {
          const localKey = getStorageKey("advisor_reports", currentUser);
          const raw = localStorage.getItem(localKey);
          const currentLocal = raw ? JSON.parse(raw) : [];
          const list = Array.isArray(currentLocal) ? currentLocal : [];
          const updated = [d.report, ...list.filter((item) => item._id !== d.report._id)];
          localStorage.setItem(localKey, JSON.stringify(updated));
        } catch (e) {}

        await loadReportsAndStats();
        if (userRole === "admin") loadAdminData();
      } else {
        alert(`Analysis error: ${d.error}`);
      }
    } catch (e) {
      alert("Backend not reachable. Ensure Express is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      checkHealth();
      loadReportsAndStats();
      if (userRole === "admin") {
        loadAdminData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userRole]);

  const copyToClipboard = (text) => {
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const download = () => {
    if (!report) return;
    const a = report.analysis;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 35;

    const drawBanner = () => {
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 24, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text("QueryPilot", margin, 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("SQL Optimization Report", margin, 18);
    };

    const checkPageBreak = (neededHeight) => {
      if (y + neededHeight > 275) {
        doc.addPage();
        drawBanner();
        y = 35;
      }
    };

    drawBanner();

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Score: ${a.performanceScore}/100`, margin + 5, y + 8);
    doc.text(`Risk: ${a.riskLevel}`, margin + 55, y + 8);
    doc.text(`Query Type: ${a.queryType}`, margin + 110, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Est. Execution Impact: ${a.executionEstimate || "N/A"}`, margin + 5, y + 15);
    y += 26;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Submitted SQL Query:", margin, y);
    y += 5;

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(14, 116, 144);
    const sqlLines = doc.splitTextToSize(report.sql, contentWidth);
    doc.text(sqlLines, margin, y);
    y += sqlLines.length * 3.8 + 6;

    if (a.correctedQuery) {
      checkPageBreak(25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(16, 185, 129);
      doc.text("AI-Recommended Corrected Query:", margin, y);
      y += 5;

      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const correctedLines = doc.splitTextToSize(a.correctedQuery, contentWidth);
      doc.text(correctedLines, margin, y);
      y += correctedLines.length * 3.8 + 6;
    }

    checkPageBreak(15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(185, 28, 28);
    doc.text("Identified Bottlenecks:", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    (a.findings || []).forEach((f) => {
      checkPageBreak(8);
      const line = `• [${f.severity}] ${f.title}: ${f.detail}`;
      const split = doc.splitTextToSize(line, contentWidth);
      doc.text(split, margin, y);
      y += split.length * 4 + 1.5;
    });

    y += 3;

    checkPageBreak(15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text("Recommended Indexes:", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    (a.indexes || []).forEach((idx) => {
      checkPageBreak(8);
      const line = `• Column: ${idx.column} (Priority: ${idx.priority}) -> ${idx.recommendation}`;
      const split = doc.splitTextToSize(line, contentWidth);
      doc.text(split, margin, y);
      y += split.length * 4 + 1.5;
    });

    y += 3;

    checkPageBreak(15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Optimization Actions for DBA:", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    (a.optimizations || []).forEach((opt, idx) => {
      checkPageBreak(8);
      const split = doc.splitTextToSize(`${idx + 1}. ${opt}`, contentWidth);
      doc.text(split, margin, y);
      y += split.length * 4 + 1.5;
    });

    doc.save(`optimization-report-${Date.now()}.pdf`);
  };

  if (!currentUser && !showAuth) {
    return (
      <WelcomeScreen
        onGetStarted={() => {
          setInitialAuthMode("login");
          setShowAuth(true);
        }}
        onRegister={() => {
          setInitialAuthMode("register");
          setShowAuth(true);
        }}
      />
    );
  }

  if (!currentUser && showAuth) {
    return (
      <AuthScreen
        initialMode={initialAuthMode}
        onLoginSuccess={(email, role) => {
          setCurrentUser(email);
          setUserRole(role || "user");
          setShowAuth(false);
        }}
        onBackToWelcome={() => setShowAuth(false)}
      />
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f172a" }}>
      {/* ---------------- LEFT SIDEBAR COLUMN ---------------- */}
      <aside
        style={{
          width: "260px",
          minWidth: "260px",
          background: "#1e293b",
          borderRight: "1px solid #334155",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "20px 16px",
          position: "sticky",
          top: 0,
          height: "100vh",
          boxSizing: "border-box",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
            <div
              style={{
                background: "#2563eb",
                padding: "8px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={20} color="#ffffff" />
            </div>
            <div>
              <b style={{ display: "block", fontSize: "16px", color: "#f8fafc" }}>QueryPilot</b>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Query Performance Advisor</span>
            </div>
          </div>

          <label
            style={{
              fontSize: "11px",
              color: "#64748b",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "block",
              marginBottom: "10px",
            }}
          >
            Navigation
          </label>

          <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={() => setActiveTab("workbench")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "500",
                border: "none",
                cursor: "pointer",
                background: activeTab === "workbench" ? "#2563eb" : "transparent",
                color: activeTab === "workbench" ? "#ffffff" : "#94a3b8",
              }}
            >
              <Terminal size={16} /> Workbench
            </button>

            <button
              onClick={() => {
                setActiveTab("dashboard");
                loadReportsAndStats();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "500",
                border: "none",
                cursor: "pointer",
                background: activeTab === "dashboard" ? "#2563eb" : "transparent",
                color: activeTab === "dashboard" ? "#ffffff" : "#94a3b8",
              }}
            >
              <BarChart3 size={16} /> Analytics Dashboard
            </button>

            {userRole === "admin" && (
              <button
                onClick={() => {
                  setActiveTab("admin");
                  loadAdminData();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "500",
                  border: "none",
                  cursor: "pointer",
                  background: activeTab === "admin" ? "#2563eb" : "transparent",
                  color: activeTab === "admin" ? "#ffffff" : "#94a3b8",
                }}
              >
                <Shield size={16} /> Admin Portal
              </button>
            )}

            <button
              onClick={() => setActiveTab("settings")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "500",
                border: "none",
                cursor: "pointer",
                background: activeTab === "settings" ? "#2563eb" : "transparent",
                color: activeTab === "settings" ? "#ffffff" : "#94a3b8",
              }}
            >
              <Settings size={16} /> Settings
            </button>

            <button
              onClick={() => setActiveTab("help")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "500",
                border: "none",
                cursor: "pointer",
                background: activeTab === "help" ? "#2563eb" : "transparent",
                color: activeTab === "help" ? "#ffffff" : "#94a3b8",
              }}
            >
              <HelpCircle size={16} /> Help & Support
            </button>
          </nav>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "16px", borderTop: "1px solid #334155" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "500",
              background: health ? "#064e3b33" : "#450a0a33",
              color: health ? "#34d399" : "#f87171",
              border: `1px solid ${health ? "#05966955" : "#dc262655"}`,
            }}
          >
            <Database size={14} />
            <span>{health ? "MongoDB Connected" : "MongoDB Offline"}</span>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Signed in as</span>
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: userRole === "admin" ? "#2563eb33" : "#334155",
                  color: userRole === "admin" ? "#60a5fa" : "#94a3b8",
                  fontWeight: "600",
                  textTransform: "uppercase",
                }}
              >
                {userRole}
              </span>
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "#f8fafc",
                fontWeight: "500",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: "10px",
              }}
              title={getDisplayName(currentUser)}
            >
              {getDisplayName(currentUser)}
            </div>

            <button
              onClick={() => setActiveTab("settings")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
                padding: "8px",
                fontSize: "12px",
                fontWeight: "500",
                background: "#334155",
                color: "#f8fafc",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              <Settings size={14} /> Manage Account
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {activeTab === "settings" ? (
          <SettingsView
            currentUser={currentUser}
            userRole={userRole}
            health={health}
            onLogout={handleLogout}
          />
        ) : activeTab === "help" ? (
          <HelpSupportView
            health={health}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        ) : activeTab === "admin" && userRole === "admin" ? (
          <AdminPortalView
            users={adminUsers}
            reports={adminReports}
            stats={adminStats}
            refreshing={refreshing}
            generatingReport={generatingReport}
            onRefresh={loadAdminData}
            onGenerateReport={handleGenerateAdminReport}
            onSelectQuery={(q) => {
              setSql(q);
              setActiveTab("workbench");
            }}
          />
        ) : activeTab === "dashboard" ? (
          <DashboardView
            stats={stats}
            reports={reports}
            refreshing={refreshing}
            onRefresh={loadReportsAndStats}
            onSelectQuery={(q) => {
              setSql(q);
              setActiveTab("workbench");
            }}
          />
        ) : (
          <main style={{ padding: "28px 36px", maxWidth: "1200px", width: "100%", boxSizing: "border-box" }}>
            <section className="hero" style={{ marginBottom: "24px" }}>
              <div>
                <label>DATABASE PERFORMANCE WORKBENCH</label>
                <h1>
                  Analyze. Optimize.
                  <br />
                  <em>Perform Better.</em>
                </h1>
                <p>
                  Analyze SQL queries, discover bottlenecks, generate AI-corrected queries,
                  and export DBA-ready optimization reports.
                </p>
              </div>

              <div className="heroStats" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <div
                  onClick={() => setSql(SAMPLE_EXPLAINABLE)}
                  style={{ cursor: "pointer", border: "1px solid #334155", userSelect: "none" }}
                  title="Click to load Explainable AI sample query"
                >
                  <Activity color="#38bdf8" />
                  <b>Explainable AI</b>
                  <small>Rule-based analysis (Click to test)</small>
                </div>

                <div
                  onClick={() => setSql(SAMPLE_DBA)}
                  style={{ cursor: "pointer", border: "1px solid #334155", userSelect: "none" }}
                  title="Click to load DBA index sample query"
                >
                  <ShieldCheck color="#10b981" />
                  <b>DBA Ready</b>
                  <small>Index recommendations (Click to test)</small>
                </div>

                <div
                  onClick={() => setSql(SAMPLE_MEDIUM)}
                  style={{ cursor: "pointer", border: "1px solid #334155", userSelect: "none" }}
                  title="Click to load Aggregation / Medium Risk query"
                >
                  <Gauge color="#f59e0b" />
                  <b>Medium Risk</b>
                  <small>Aggregation buffer (Click to test)</small>
                </div>

                <div
                  onClick={() => setSql(SAMPLE_SUBQUERY)}
                  style={{ cursor: "pointer", border: "1px solid #334155", userSelect: "none" }}
                  title="Click to load Nested Subquery test"
                >
                  <Layers color="#a855f7" />
                  <b>Subquery Test</b>
                  <small>IN () sub-loop check (Click to test)</small>
                </div>
              </div>
            </section>

            <section className="layout">
              <div className="card editor">
                <div className="head">
                  <div>
                    <h2>SQL Query</h2>
                    <small>Paste a query for analysis</small>
                  </div>
                  <button onClick={() => setSql(SAMPLE_DEFAULT)}>Load Default Sample</button>
                </div>
                <textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={8} />
                <div className="actions">
                  <button className="primary" onClick={analyze} disabled={loading}>
                    {loading ? "Analyzing..." : "Analyze Query →"}
                  </button>
                  <button onClick={() => setSql("")}>Clear</button>
                </div>
              </div>

              <div className="card">
                <div className="head">
                  <div>
                    <h2>Performance Overview</h2>
                    <small>Static analysis result</small>
                  </div>
                  {report && (
                    <span className={"pill " + report.analysis.riskLevel.toLowerCase()}>
                      {report.analysis.riskLevel} Risk
                    </span>
                  )}
                </div>
                {report ? (
                  <>
                    <div className="scoreRow">
                      <div className="score">{report.analysis.performanceScore}</div>
                      <div>
                        <b>Performance Score / 100</b>
                        <p>{report.analysis.executionEstimate}</p>
                      </div>
                    </div>
                    <div className="metrics">
                      <Metric n="Query Type" v={report.analysis.queryType} />
                      <Metric n="Joins" v={report.analysis.metrics.joins} />
                      <Metric n="Filters" v={report.analysis.metrics.filters} />
                      <Metric n="Functions" v={report.analysis.metrics.functions} />
                    </div>
                  </>
                ) : (
                  <div className="empty">Run an analysis to see performance metrics.</div>
                )}
              </div>
            </section>

            {report?.analysis?.correctedQuery && (
              <section
                className="card"
                style={{
                  marginTop: "16px",
                  border: "1px solid #059669",
                  background: "linear-gradient(180deg, #064e3b15 0%, transparent 100%)",
                }}
              >
                <div className="head">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ background: "#059669", padding: "6px", borderRadius: "6px", display: "flex" }}>
                      <Wand2 size={16} color="#ffffff" />
                    </div>
                    <div>
                      <h2 style={{ color: "#34d399", margin: 0 }}>AI-Recommended Corrected Query</h2>
                      <small>Optimized to avoid full-table scans and non-sargable predicates</small>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => copyToClipboard(report.analysis.correctedQuery)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "#1e293b",
                        border: "1px solid #334155",
                        color: "#f8fafc",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      {copied ? <CheckCheck size={14} color="#34d399" /> : <Copy size={14} />}
                      {copied ? "Copied!" : "Copy SQL"}
                    </button>

                    <button
                      onClick={() => setSql(report.analysis.correctedQuery)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "#059669",
                        border: "none",
                        color: "#ffffff",
                        padding: "6px 14px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "12px",
                      }}
                    >
                      <Zap size={14} /> Apply to Editor
                    </button>
                  </div>
                </div>

                <pre
                  style={{
                    background: "#0f172a",
                    padding: "16px",
                    borderRadius: "6px",
                    color: "#38bdf8",
                    fontFamily: "Consolas, Monaco, monospace",
                    fontSize: "13.5px",
                    overflowX: "auto",
                    lineHeight: "1.6",
                    margin: "12px 0 10px 0",
                    border: "1px solid #1e293b",
                  }}
                >
                  {report.analysis.correctedQuery}
                </pre>
              </section>
            )}

            {report && (
              <>
                <section className="layout lower">
                  <Panel title="Performance Bottlenecks" icon={<TriangleAlert />}>
                    {report.analysis.findings.map((f, i) => (
                      <div className="finding" key={i}>
                        <span>{f.severity}</span>
                        <b>{f.title}</b>
                        <p>{f.detail}</p>
                      </div>
                    ))}
                  </Panel>
                  <Panel title="Index Recommendations" icon={<Database />}>
                    {report.analysis.indexes.map((x, i) => (
                      <div className="index" key={i}>
                        <div>
                          <b>{x.column}</b>
                          <p>{x.recommendation}</p>
                        </div>
                        <span>{x.priority}</span>
                      </div>
                    ))}
                  </Panel>
                </section>

                <section className="card">
                  <div className="head">
                    <div>
                      <h2>Optimization Recommendations</h2>
                      <small>Recommended actions for the DBA</small>
                    </div>
                    <button onClick={download}>
                      <Download size={15} /> Export PDF Report
                    </button>
                  </div>
                  <ol>
                    {report.analysis.optimizations.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ol>
                </section>
              </>
            )}

            <section className="card history">
              <div className="head">
                <div>
                  <h2>Recent Reports</h2>
                  <small>Scoped to {getDisplayName(currentUser)}</small>
                </div>
                <button onClick={loadReportsAndStats} disabled={refreshing}>
                  <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />{" "}
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
              {reports.length ? (
                reports.map((r, i) => (
                  <div className="historyRow" key={i}>
                    <b>{r.title}</b>
                    <span>
                      {new Date(r.createdAt).toLocaleString()} • Score {r.analysis?.performanceScore || 0}/100
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty">No saved reports found for your account.</div>
              )}
            </section>
          </main>
        )}

        <footer style={{ marginTop: "auto", padding: "16px 36px" }}>
          MongoDB • Express.js • React.js • Node.js | AI-Powered Database Query Performance Advisor
        </footer>
      </div>
    </div>
  );
}

// ---------------- WELCOME SCREEN ---------------- //

function WelcomeScreen({ onGetStarted, onRegister }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1325",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "24px 48px",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              background: "#2563eb",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={22} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: "bold", margin: 0 }}>QueryPilot</h1>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Query Performance Advisor</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <button
            onClick={onGetStarted}
            style={{
              background: "transparent",
              border: "1px solid #334155",
              color: "#cbd5e1",
              padding: "8px 18px",
              borderRadius: "8px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Sign In
          </button>
          <button
            onClick={onRegister}
            style={{
              background: "#2563eb",
              border: "none",
              color: "#ffffff",
              padding: "8px 18px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Get Started Free
          </button>
        </div>
      </header>

      <main style={{ maxWidth: "1080px", margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: "44px", fontWeight: 800, margin: "0 0 18px 0" }}>
          Welcome to <span style={{ color: "#38bdf8" }}>Query Advisor</span>
        </h1>
        <p style={{ fontSize: "16px", color: "#94a3b8", maxWidth: "680px", margin: "0 auto 36px auto" }}>
          Diagnose database bottlenecks, eliminate full table scans, generate DBA-ready composite
          indexes, and inspect AI-corrected SQL queries.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
          <button
            onClick={onGetStarted}
            style={{
              background: "#2563eb",
              border: "none",
              color: "#ffffff",
              padding: "12px 28px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Launch Advisor →
          </button>
        </div>
      </main>

      <footer style={{ borderTop: "1px solid #1e293b", padding: "20px 48px", textAlign: "center", fontSize: "12px", color: "#64748b" }}>
        QueryPilot • Full-Stack Query Performance Advisor
      </footer>
    </div>
  );
}

// ---------------- DASHBOARD VIEW ---------------- //

function DashboardView({ stats, reports, refreshing, onRefresh, onSelectQuery }) {
  const [searchTerm, setSearchTerm] = useState("");
  const highRiskCount = stats.highRisk || reports.filter((r) => r.analysis?.riskLevel === "High").length;

  const filteredReports = reports.filter((r) =>
    (r.sql || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main style={{ padding: "28px 36px", maxWidth: "1200px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "22px" }}>Health & Workload Dashboard</h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>MongoDB Aggregated Performance</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            background: "#1e293b",
            color: "#ffffff",
            border: "1px solid #334155",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh Stats
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <DashboardCard title="Total Queries" value={stats.total || reports.length} icon={<Layers color="#38bdf8" size={24} />} detail="Audited sessions" />
        <DashboardCard title="Avg Score" value={`${stats.averageScore || 0} / 100`} icon={<Gauge color="#10b981" size={24} />} detail="Across your queries" />
        <DashboardCard title="High Risk Queries" value={highRiskCount} icon={<ShieldAlert color="#ef4444" size={24} />} detail="Requires indexing" />
      </div>

      <div className="card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>Query Workload History</h3>
          <input
            type="text"
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "4px",
              padding: "6px 10px",
              fontSize: "12px",
              color: "#f8fafc",
            }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                <th style={{ padding: "8px 10px" }}>SQL Snippet</th>
                <th style={{ padding: "8px 10px" }}>Score</th>
                <th style={{ padding: "8px 10px" }}>Risk</th>
                <th style={{ padding: "8px 10px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.slice(0, 10).map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td
                    style={{
                      padding: "10px",
                      fontFamily: "monospace",
                      color: "#38bdf8",
                      maxWidth: "230px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.sql}
                  </td>
                  <td style={{ padding: "10px", fontWeight: "bold" }}>{r.analysis?.performanceScore || 0}</td>
                  <td style={{ padding: "10px" }}>
                    <span className={"pill " + (r.analysis?.riskLevel?.toLowerCase() || "low")}>
                      {r.analysis?.riskLevel || "Low"}
                    </span>
                  </td>
                  <td style={{ padding: "10px" }}>
                    <button
                      onClick={() => onSelectQuery(r.sql)}
                      style={{
                        background: "#2563eb",
                        border: "none",
                        color: "#fff",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Load
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

// ---------------- ADMIN PORTAL VIEW ---------------- //

function AdminPortalView({
  users,
  reports,
  stats,
  refreshing,
  generatingReport,
  onRefresh,
  onGenerateReport,
  onSelectQuery,
}) {
  const [userSearch, setUserSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");

  const filteredUsers = users.filter((u) =>
    (u.email || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredReports = reports.filter(
    (r) =>
      (r.userEmail || "").toLowerCase().includes(reportSearch.toLowerCase()) ||
      (r.sql || "").toLowerCase().includes(reportSearch.toLowerCase())
  );

  return (
    <main style={{ padding: "28px 36px", maxWidth: "1200px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={20} color="#3b82f6" />
            <h1 style={{ margin: 0, fontSize: "22px" }}>Administrator Control Center</h1>
          </div>
          <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "14px" }}>
            Global overview of all user actions, queries, and system audit reporting
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: "#1e293b",
              color: "#ffffff",
              border: "1px solid #334155",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>

          <button
            onClick={onGenerateReport}
            disabled={generatingReport}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: generatingReport ? "wait" : "pointer",
              fontWeight: "600",
              fontSize: "13px",
            }}
          >
            <FileText size={15} /> {generatingReport ? "Generating Audit..." : "Generate Audit Report"}
          </button>
        </div>
      </div>

      {/* Admin Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <DashboardCard
          title="Registered Users"
          value={stats?.totalUsers || users.length}
          icon={<Users color="#38bdf8" size={24} />}
          detail="Active accounts in database"
        />
        <DashboardCard
          title="Total User Queries"
          value={stats?.totalReports || reports.length}
          icon={<Layers color="#a855f7" size={24} />}
          detail="All audited SQL executions"
        />
        <DashboardCard
          title="Workload Avg Score"
          value={`${stats?.averageScore || 0} / 100`}
          icon={<Gauge color="#10b981" size={24} />}
          detail="Across all registered users"
        />
        <DashboardCard
          title="High Risk User Queries"
          value={stats?.highRisk || reports.filter((r) => r.analysis?.riskLevel === "High").length}
          icon={<ShieldAlert color="#ef4444" size={24} />}
          detail="Requires immediate DBA action"
        />
      </div>

      {/* Users Activity Table */}
      <div className="card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px" }}>Users & Execution Summary</h3>
            <small style={{ color: "#94a3b8" }}>Overview of what each registered user has done</small>
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "4px",
              padding: "6px 10px",
              fontSize: "12px",
              color: "#f8fafc",
            }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                <th style={{ padding: "8px 10px" }}>User Email</th>
                <th style={{ padding: "8px 10px" }}>Role</th>
                <th style={{ padding: "8px 10px" }}>Queries Run</th>
                <th style={{ padding: "8px 10px" }}>Avg Score</th>
                <th style={{ padding: "8px 10px" }}>High Risk</th>
                <th style={{ padding: "8px 10px" }}>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "10px", fontWeight: "500", color: "#f8fafc" }}>{u.email}</td>
                  <td style={{ padding: "10px" }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "600",
                        background: u.role === "admin" ? "#2563eb33" : "#334155",
                        color: u.role === "admin" ? "#60a5fa" : "#94a3b8",
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: "10px" }}>{u.totalQueries || 0}</td>
                  <td style={{ padding: "10px", fontWeight: "600" }}>{u.averageScore || 0}/100</td>
                  <td style={{ padding: "10px", color: (u.highRiskQueries || 0) > 0 ? "#f87171" : "#34d399" }}>
                    {u.highRiskQueries || 0}
                  </td>
                  <td style={{ padding: "10px", color: "#94a3b8", fontSize: "12px" }}>
                    {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* All User Queries Table */}
      <div className="card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px" }}>All User Query Executions</h3>
            <small style={{ color: "#94a3b8" }}>Recent queries submitted across all user accounts</small>
          </div>
          <input
            type="text"
            placeholder="Search queries or user email..."
            value={reportSearch}
            onChange={(e) => setReportSearch(e.target.value)}
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "4px",
              padding: "6px 10px",
              fontSize: "12px",
              color: "#f8fafc",
            }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                <th style={{ padding: "8px 10px" }}>User</th>
                <th style={{ padding: "8px 10px" }}>SQL Snippet</th>
                <th style={{ padding: "8px 10px" }}>Score</th>
                <th style={{ padding: "8px 10px" }}>Risk</th>
                <th style={{ padding: "8px 10px" }}>Timestamp</th>
                <th style={{ padding: "8px 10px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.slice(0, 25).map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "10px", color: "#94a3b8", fontSize: "12px" }}>{r.userEmail}</td>
                  <td
                    style={{
                      padding: "10px",
                      fontFamily: "monospace",
                      color: "#38bdf8",
                      maxWidth: "220px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.sql}
                  </td>
                  <td style={{ padding: "10px", fontWeight: "bold" }}>{r.analysis?.performanceScore || 0}</td>
                  <td style={{ padding: "10px" }}>
                    <span className={"pill " + (r.analysis?.riskLevel?.toLowerCase() || "low")}>
                      {r.analysis?.riskLevel || "Low"}
                    </span>
                  </td>
                  <td style={{ padding: "10px", color: "#64748b", fontSize: "11px" }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px" }}>
                    <button
                      onClick={() => onSelectQuery(r.sql)}
                      style={{
                        background: "#2563eb",
                        border: "none",
                        color: "#fff",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Load in Workbench
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

// ---------------- SETTINGS VIEW ---------------- //

function SettingsView({ currentUser, userRole, health, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState({ type: "", message: "" });
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordStatus({ type: "error", message: "New password must contain at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "error", message: "New passwords do not match." });
      return;
    }

    setSubmittingPassword(true);
    setPasswordStatus({ type: "", message: "" });

    try {
      const res = await authFetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: getDisplayName(currentUser),
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPasswordStatus({ type: "error", message: data.error || "Failed to update password." });
      } else {
        setPasswordStatus({ type: "success", message: "Password updated successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setPasswordStatus({ type: "error", message: "Failed to connect to backend service." });
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleClearCache = () => {
    if (window.confirm("Are you sure you want to clear your local report cache? Synced backend data will remain safe.")) {
      const localReportsKey = getStorageKey("advisor_reports", currentUser);
      const localStatsKey = getStorageKey("advisor_stats", currentUser);
      localStorage.removeItem(localReportsKey);
      localStorage.removeItem(localStatsKey);
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    background: "#0f172a",
    border: "1px solid #475569",
    color: "#ffffff",
    boxSizing: "border-box",
    fontSize: "13px",
  };

  return (
    <main style={{ padding: "28px 36px", maxWidth: "1200px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <div style={{ background: "#2563eb", padding: "8px", borderRadius: "8px", display: "flex" }}>
            <Settings size={20} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px" }}>Account & System Settings</h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
              Manage your credentials, database preferences, diagnostics, and session
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "20px" }}>
        {/* Account Profile Card */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <ShieldCheck size={20} color="#38bdf8" />
            <h3 style={{ margin: 0, fontSize: "16px" }}>User Profile</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #334155" }}>
              <span style={{ color: "#94a3b8" }}>Account Email</span>
              <span style={{ color: "#f8fafc", fontWeight: "600" }}>{getDisplayName(currentUser)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #334155" }}>
              <span style={{ color: "#94a3b8" }}>Account Role</span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  background: userRole === "admin" ? "#2563eb33" : "#334155",
                  color: userRole === "admin" ? "#60a5fa" : "#94a3b8",
                }}
              >
                {userRole === "admin" ? "Administrator" : "Standard User"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #334155" }}>
              <span style={{ color: "#94a3b8" }}>Session Status</span>
              <span style={{ color: "#34d399", fontWeight: "500", display: "flex", alignItems: "center", gap: "4px" }}>
                ● Active JWT Session (7-Day Expiry)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Local Storage Key</span>
              <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: "11px" }}>
                {getStorageKey("advisor_reports", currentUser)}
              </span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <KeyRound size={20} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: "16px" }}>Security & Password</h3>
          </div>

          {passwordStatus.message && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                marginBottom: "14px",
                background: passwordStatus.type === "error" ? "#450a0a" : "#064e3b33",
                color: passwordStatus.type === "error" ? "#f87171" : "#34d399",
                border: `1px solid ${passwordStatus.type === "error" ? "#dc262655" : "#05966955"}`,
              }}
            >
              {passwordStatus.message}
            </div>
          )}

          <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                Current Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="Min 6 chars"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingPassword}
              style={{
                marginTop: "4px",
                padding: "9px 16px",
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "12px",
                cursor: submittingPassword ? "wait" : "pointer",
                alignSelf: "flex-start",
              }}
            >
              {submittingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

        {/* Database & Diagnostics Card */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <Database size={20} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: "16px" }}>Database & System Diagnostics</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #334155" }}>
              <span style={{ color: "#94a3b8" }}>MongoDB Connection</span>
              <span style={{ color: health ? "#34d399" : "#f87171", fontWeight: "600" }}>
                {health ? "Online & Synchronized" : "Offline / Unreachable"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #334155" }}>
              <span style={{ color: "#94a3b8" }}>Backend API Service</span>
              <span style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "12px" }}>
                {API.replace("http://", "").replace("https://", "")}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #334155" }}>
              <span style={{ color: "#94a3b8" }}>Query Rule Matchers</span>
              <span style={{ color: "#f8fafc" }}>8 Static AST Inspect Rules</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>AI Query Optimizer</span>
              <span style={{ color: "#34d399" }}>Enabled (Covering & SARGable)</span>
            </div>
          </div>
        </div>

        {/* Cache & Danger Zone Card with Prominent Logout */}
        <div className="card" style={{ padding: "24px", border: "1px solid #ef444455", background: "linear-gradient(180deg, #450a0a15 0%, transparent 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <LogOut size={20} color="#ef4444" />
            <h3 style={{ margin: 0, fontSize: "16px", color: "#f87171" }}>Session & Data Management</h3>
          </div>

          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 16px 0", lineHeight: "1.5" }}>
            Sign out of your active workstation session or clear locally stored query reports.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#0f172a", borderRadius: "6px", border: "1px solid #334155" }}>
              <div>
                <b style={{ display: "block", fontSize: "13px", color: "#f8fafc" }}>Local Cache</b>
                <small style={{ color: "#64748b" }}>Clear saved client history from this browser</small>
              </div>
              <button
                onClick={handleClearCache}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  background: "#1e293b",
                  border: "1px solid #475569",
                  color: "#cbd5e1",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={13} /> {cacheCleared ? "Cleared!" : "Clear Cache"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#450a0a22", borderRadius: "6px", border: "1px solid #dc262644" }}>
              <div>
                <b style={{ display: "block", fontSize: "13px", color: "#f87171" }}>Account Logout</b>
                <small style={{ color: "#94a3b8" }}>Terminate active session and return to welcome portal</small>
              </div>
              <button
                onClick={onLogout}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 18px",
                  background: "#dc2626",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------- HELP & SUPPORT VIEW ---------------- //

function HelpSupportView({ health, onNavigate }) {
  const [openFaq, setOpenFaq] = useState(0);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [ticketSent, setTicketSent] = useState(false);

  const faqs = [
    {
      q: "How is the SQL Performance Score (0 - 100) calculated?",
      a: "Every analyzed query starts with a baseline score of 100. QueryPilot inspects the Abstract Syntax Tree (AST) for known anti-patterns and applies weighted deductions:\n• Non-sargable functions on indexed columns (-20)\n• Leading wildcards in LIKE predicates (-25)\n• Wildcard SELECT * on multi-table joins (-15)\n• Unconstrained cartesian cross joins (-30)\n• Unbounded sorting buffers without LIMIT (-10)."
    },
    {
      q: "What makes a query 'High Risk' vs 'Medium Risk'?",
      a: "• High Risk (< 50): Forces full table scans (FTS) on entire datasets, uses non-sargable string wrappers, or contains unbounded loops.\n• Medium Risk (50 - 79): Contains multiple joins or sorting buffers that may cause memory spills under concurrent loads.\n• Low Risk (80 - 100): Uses indexed column projections, anchored range scans, and appropriate limit bounds."
    },
    {
      q: "What does SARGable mean and why does QueryPilot rewrite queries?",
      a: "SARGable stands for 'Search Argument Able'. When a query applies functions like LOWER(customer_email) = 'xyz', relational engines cannot use B-Tree indexes because the value is mutated per row. QueryPilot automatically rewrites expressions to avoid non-sargable wrappers, replacing them with index-friendly equivalents."
    },
    {
      q: "How do Composite Index recommendations work?",
      a: "QueryPilot adheres to the ESR (Equality, Sort, Range) rule. It recommends multi-column composite indexes that match your WHERE equality filters first, ORDER BY sort keys second, and range filters last, giving you production-ready CREATE INDEX statements."
    },
    {
      q: "What features are available in the Admin Portal?",
      a: "Administrators can monitor all registered user accounts, track execution frequencies, inspect average performance scores, load any user's past queries directly into Workbench, and generate comprehensive Enterprise Compliance Audit PDF reports."
    }
  ];

  const handleSendTicket = (e) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketBody.trim()) return;
    setTicketSent(true);
    setTimeout(() => {
      setTicketSubject("");
      setTicketBody("");
      setTicketSent(false);
      alert("Your inquiry has been logged! Our Database Performance Advisory team will follow up via email.");
    }, 1000);
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    background: "#0f172a",
    border: "1px solid #475569",
    color: "#ffffff",
    boxSizing: "border-box",
    fontSize: "13px",
  };

  return (
    <main style={{ padding: "28px 36px", maxWidth: "1200px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <div style={{ background: "#2563eb", padding: "8px", borderRadius: "8px", display: "flex" }}>
            <HelpCircle size={20} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px" }}>Help & Technical Support</h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
              Quick-start workflow, query optimization guides, FAQ reference, and DBA advisory
            </p>
          </div>
        </div>
      </div>

      {/* 3-Step Core Workflow Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <span style={{ background: "#2563eb", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold" }}>1</span>
            <b style={{ color: "#f8fafc", fontSize: "15px" }}>Paste or Write SQL</b>
          </div>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0, lineHeight: "1.5" }}>
            Load a sample query or paste your production SQL statements into the Workbench editor. Supports multi-table JOINs, subqueries, and aggregations.
          </p>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <span style={{ background: "#10b981", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold" }}>2</span>
            <b style={{ color: "#f8fafc", fontSize: "15px" }}>Inspect Bottlenecks</b>
          </div>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0, lineHeight: "1.5" }}>
            Review your static performance score out of 100, identified bottlenecks with severity levels, and AI-recommended composite index strategies.
          </p>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <span style={{ background: "#a855f7", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold" }}>3</span>
            <b style={{ color: "#f8fafc", fontSize: "15px" }}>Apply & Export PDF</b>
          </div>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0, lineHeight: "1.5" }}>
            Click "Apply to Editor" to test the AI-corrected query immediately, or click "Export PDF Report" to hand off DBA action items directly.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", marginBottom: "28px" }}>
        {/* Interactive FAQ Section */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <BookOpen size={20} color="#38bdf8" />
            <h3 style={{ margin: 0, fontSize: "16px" }}>Frequently Asked Questions</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{
                  background: "#0f172a",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "12px 14px",
                    background: "transparent",
                    border: "none",
                    color: "#f8fafc",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={16} color="#38bdf8" /> : <ChevronDown size={16} color="#94a3b8" />}
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 14px 14px 14px", fontSize: "13px", color: "#94a3b8", lineHeight: "1.6", whiteSpace: "pre-line", borderTop: "1px solid #1e293b" }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Support & Ticket Submission */}
        <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <Mail size={20} color="#10b981" />
              <h3 style={{ margin: 0, fontSize: "16px" }}>Contact DBA Advisory</h3>
            </div>

            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 16px 0", lineHeight: "1.5" }}>
              Have questions regarding complex schemas or execution plans? Contact our database engineers.
            </p>

            <form onSubmit={handleSendTicket} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                  Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Query optimization for large partitioned table"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                  Description / Query Details
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your issue or paste relevant table schema..."
                  value={ticketBody}
                  onChange={(e) => setTicketBody(e.target.value)}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <button
                type="submit"
                disabled={ticketSent}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "10px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: ticketSent ? "wait" : "pointer",
                }}
              >
                <MessageSquare size={14} /> {ticketSent ? "Submitting Inquiry..." : "Submit Support Request"}
              </button>
            </form>
          </div>

          <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid #334155", fontSize: "12px", color: "#64748b" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>Support Desk Email:</span>
              <span style={{ color: "#38bdf8" }}>support@querypilot.ai</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Response SLA:</span>
              <span style={{ color: "#f8fafc" }}>Under 24 Hours</span>
            </div>
          </div>
        </div>
      </div>

      {/* SQL Optimization Cheat Sheet */}
      <div className="card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <Zap size={20} color="#f59e0b" />
          <h3 style={{ margin: 0, fontSize: "16px" }}>DBA Performance Quick Rules (Cheat Sheet)</h3>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
          <div style={{ background: "#0f172a", padding: "14px", borderRadius: "6px", border: "1px solid #334155" }}>
            <b style={{ color: "#38bdf8", fontSize: "13px", display: "block", marginBottom: "6px" }}>1. Avoid SELECT *</b>
            <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: "1.4" }}>
              Explicit column projection reduces network I/O and allows queries to be satisfied entirely by index-only covering scans.
            </p>
          </div>

          <div style={{ background: "#0f172a", padding: "14px", borderRadius: "6px", border: "1px solid #334155" }}>
            <b style={{ color: "#10b981", fontSize: "13px", display: "block", marginBottom: "6px" }}>2. Anchored Prefix LIKE</b>
            <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: "1.4" }}>
              Leading wildcards like <code>'%term'</code> invalidate B-Trees. Use anchored prefix patterns like <code>'term%'</code>.
            </p>
          </div>

          <div style={{ background: "#0f172a", padding: "14px", borderRadius: "6px", border: "1px solid #334155" }}>
            <b style={{ color: "#f59e0b", fontSize: "13px", display: "block", marginBottom: "6px" }}>3. Bound Large Sorts</b>
            <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: "1.4" }}>
              Always combine <code>ORDER BY</code> with <code>LIMIT</code> to prevent temporary tables and memory buffer overflows.
            </p>
          </div>

          <div style={{ background: "#0f172a", padding: "14px", borderRadius: "6px", border: "1px solid #334155" }}>
            <b style={{ color: "#a855f7", fontSize: "13px", display: "block", marginBottom: "6px" }}>4. Composite Indexes (ESR)</b>
            <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: "1.4" }}>
              Order columns: Equality first, Sort second, Range third. Example: <code>(status, created_at, amount)</code>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function DashboardCard({ title, value, icon, detail }) {
  return (
    <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", color: "#94a3b8" }}>{title}</span>
        {icon}
      </div>
      <div style={{ fontSize: "24px", fontWeight: "bold", color: "#f8fafc" }}>{value}</div>
      <small style={{ color: "#64748b", fontSize: "11px" }}>{detail}</small>
    </div>
  );
}

// ---------------- AUTHENTICATION SCREEN ---------------- //

function AuthScreen({ initialMode = "login", onLoginSuccess, onBackToWelcome }) {
  const [mode, setMode] = useState(initialMode);
  const [portalType, setPortalType] = useState("user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const loginId = email.trim();
    if (!loginId || !password.trim()) {
      setError("Enter an email and password.");
      return;
    }

    if (mode === "register" && !name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const endpoint = mode === "register" ? `${API}/auth/register` : `${API}/auth/login`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          userName: name.trim(),
          email: loginId,
          password,
          role: portalType,
        }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {}

      if (!res.ok || data.ok === false || !data.token) {
        setError(data.error || data.message || `${mode === "login" ? "Login" : "Registration"} failed (${res.status}).`);
        return;
      }

      const userId = data.user?.email || data.user?.username || data.email || loginId;
      const role = data.user?.role || (portalType === "admin" ? "admin" : "user");

      if (mode === "login") {
        if (portalType === "admin" && role !== "admin") {
          setError("Administrator account not recognized or access denied.");
          return;
        }
      }

      try {
        localStorage.setItem("advisor_token", data.token);
        localStorage.setItem("advisor_user", userId);
        localStorage.setItem("advisor_role", role);
      } catch (err) {}

      onLoginSuccess(userId, role);
    } catch (err) {
      // Offline fallback: ensure admin or open user login never stalls
      const lower = loginId.toLowerCase();
      if (portalType === "admin" || lower === "admin@demo.edu" || lower === "admin2@demo.edu") {
        if (
          (lower === "admin@demo.edu" && password.trim() === "Admin@123") ||
          (lower === "admin2@demo.edu" && password.trim() === "Admin@456")
        ) {
          localStorage.setItem("advisor_token", "demo-admin-token");
          localStorage.setItem("advisor_user", lower);
          localStorage.setItem("advisor_role", "admin");
          onLoginSuccess(lower, "admin");
          return;
        } else if (portalType === "admin") {
          setError("Invalid administrator credentials.");
          return;
        }
      }

      // Normal User fallback: user can login with any email and password
      if (portalType === "user") {
        localStorage.setItem("advisor_token", "demo-user-token");
        localStorage.setItem("advisor_user", loginId);
        localStorage.setItem("advisor_role", "user");
        onLoginSuccess(loginId, "user");
        return;
      }

      setError("Backend not reachable. Ensure Express server is running.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    background: "#0f172a",
    border: "1px solid #475569",
    color: "#ffffff",
    boxSizing: "border-box",
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
          maxWidth: "400px",
          border: "1px solid #334155",
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Zap size={22} color="#3b82f6" />
            <h2 style={{ margin: 0, fontSize: "20px" }}>QueryPilot</h2>
          </div>
          <button
            onClick={onBackToWelcome}
            style={{ background: "transparent", border: "none", color: "#64748b", fontSize: "12px", cursor: "pointer" }}
          >
            ← Back
          </button>
        </div>

        {/* Portal Selection Switch (User Login vs Admin Login) */}
        {mode === "login" && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              background: "#0f172a",
              padding: "4px",
              borderRadius: "8px",
              marginBottom: "16px",
              border: "1px solid #334155",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setPortalType("user");
                setError("");
              }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                background: portalType === "user" ? "#2563eb" : "transparent",
                color: portalType === "user" ? "#ffffff" : "#94a3b8",
                transition: "all 0.15s ease",
              }}
            >
              User Login
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalType("admin");
                setError("");
              }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                background: portalType === "admin" ? "#2563eb" : "transparent",
                color: portalType === "admin" ? "#ffffff" : "#94a3b8",
                transition: "all 0.15s ease",
              }}
            >
              Admin Login
            </button>
          </div>
        )}

        <h3 style={{ margin: "0 0 16px 0", fontSize: "16px" }}>
          {mode === "register"
            ? "Create your user account"
            : portalType === "admin"
            ? "Administrator Authentication"
            : "Sign in to your account"}
        </h3>

        {error && (
          <div style={{ background: "#450a0a", color: "#f87171", padding: "10px", borderRadius: "6px", fontSize: "13px", marginBottom: "14px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {mode === "register" && (
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
              {portalType === "admin" && mode === "login" ? "Administrator Email" : "Email Address"}
            </label>
            <input
              type="text"
              required
              placeholder={portalType === "admin" ? "admin@company.com" : "user@company.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
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
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting
              ? "Please wait..."
              : mode === "register"
              ? "Create Account →"
              : portalType === "admin"
              ? "Sign In as Admin →"
              : "Sign In as User →"}
          </button>
        </form>

        <div style={{ marginTop: "16px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
          {mode === "login" ? "Need a normal user account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setPortalType("user");
              setError("");
              setName("");
            }}
            style={{ background: "transparent", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "12px" }}
          >
            {mode === "login" ? "Register here" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ n, v }) {
  return (
    <div>
      <small>{n}</small>
      <b>{v}</b>
    </div>
  );
}

function Panel({ title, icon, children }) {
  return (
    <div className="card">
      <div className="head">
        <div className="titleIcon">
          {icon}
          <div>
            <h2>{title}</h2>
            <small>Detected by analysis engine</small>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
