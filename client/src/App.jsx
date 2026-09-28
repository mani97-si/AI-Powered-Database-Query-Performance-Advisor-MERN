import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import {
  Activity,
  BarChart3,
  CheckCheck,
  Copy,
  Database,
  Download,
  Gauge,
  Layers,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Wand2,
  Users,
  FileText,
  User,
  Lock,
  Mail,
  Zap,
} from "lucide-react";

/* =========================================================
   API
========================================================= */

const API =
  import.meta.env.VITE_API_URL ||
  "https://ai-powered-database-query-performance.onrender.com/api";

/*
  If you are running backend locally, use:

  const API = "http://localhost:5000/api";
*/

/* =========================================================
   SAMPLE SQL
========================================================= */

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

/* =========================================================
   HELPERS
========================================================= */

function getToken() {
  try {
    return localStorage.getItem("advisor_token");
  } catch {
    return null;
  }
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem("advisor_user");

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object") {
      return parsed;
    }

    // Migration for old version where only email was stored
    if (typeof parsed === "string") {
      return {
        email: parsed,
        role: "user",
      };
    }

    return null;
  } catch {
    return null;
  }
}

function getDisplayName(user) {
  if (!user) return "User";

  if (typeof user === "string") {
    return user;
  }

  return user.email || user.username || "User";
}

function authHeaders() {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function getRiskClass(risk) {
  return String(risk || "Low").toLowerCase();
}

/* =========================================================
   MAIN APP
========================================================= */

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());

  const [showAuth, setShowAuth] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState("login");

  const [activeTab, setActiveTab] = useState("workbench");

  const [sql, setSql] = useState(SAMPLE_DEFAULT);
  const [report, setReport] = useState(null);
  const [reports, setReports] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    averageScore: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
  });

  const [health, setHealth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  /* Admin states */

  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalReports: 0,
    averageScore: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
  });

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminReports, setAdminReports] = useState([]);
  const [selectedAdminUser, setSelectedAdminUser] = useState("");

  const [adminLoading, setAdminLoading] = useState(false);

  /* =========================================================
     LOGOUT
  ========================================================= */

  const handleLogout = () => {
    try {
      localStorage.removeItem("advisor_token");
      localStorage.removeItem("advisor_user");
    } catch {}

    setCurrentUser(null);
    setReport(null);
    setReports([]);
    setStats({
      total: 0,
      averageScore: 0,
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0,
    });

    setAdminUsers([]);
    setAdminReports([]);

    setShowAuth(false);
    setActiveTab("workbench");
  };

  /* =========================================================
     AUTH VALIDATION
  ========================================================= */

  useEffect(() => {
    const validateLogin = async () => {
      const token = getToken();

      if (!token) {
        setCurrentUser(null);
        return;
      }

      try {
        const response = await fetch(`${API}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          handleLogout();
          return;
        }

        setCurrentUser(data.user);

        localStorage.setItem(
          "advisor_user",
          JSON.stringify(data.user)
        );
      } catch {
        /*
          Do not immediately logout because Render may be sleeping.
          Existing token/user can remain temporarily.
        */
      }
    };

    if (currentUser) {
      validateLogin();
    }
  }, []);

  /* =========================================================
     HEALTH CHECK
  ========================================================= */

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API}/health`);
      const data = await response.json();

      setHealth(!!data.mongodb);
    } catch {
      setHealth(false);
    }
  };

  /* =========================================================
     USER REPORTS + STATS
  ========================================================= */

  const loadReportsAndStats = async () => {
    if (!currentUser || currentUser.role !== "user") return;

    try {
      setRefreshing(true);

      const token = getToken();

      const [reportsResponse, statsResponse] = await Promise.all([
        fetch(`${API}/reports`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API}/stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const reportsData = await reportsResponse.json();
      const statsData = await statsResponse.json();

      if (reportsData.ok) {
        setReports(
          Array.isArray(reportsData.reports)
            ? reportsData.reports
            : []
        );
      }

      if (statsData.ok) {
        setStats(statsData);
      }
    } catch (error) {
      console.error("Loading user reports failed:", error);
    } finally {
      setRefreshing(false);
    }
  };

  /* =========================================================
     INITIAL USER DATA
  ========================================================= */

  useEffect(() => {
    if (!currentUser) return;

    checkHealth();

    if (currentUser.role === "user") {
      loadReportsAndStats();
    }

    if (currentUser.role === "admin") {
      loadAdminData();
    }
  }, [currentUser]);

  /* =========================================================
     SQL ANALYSIS
  ========================================================= */

  const analyze = async () => {
    if (!sql.trim()) {
      alert("Enter an SQL query.");
      return;
    }

    if (!currentUser || currentUser.role !== "user") {
      alert("Only normal users can analyze SQL queries.");
      return;
    }

    const token = getToken();

    if (!token) {
      alert("Your session has expired. Please login again.");
      handleLogout();
      return;
    }

    setLoading(true);
    setCopied(false);

    try {
      const response = await fetch(`${API}/analyze`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          title: "SQL Performance Analysis",
          sql: sql,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        alert("Session expired. Please login again.");
        handleLogout();
        return;
      }

      if (!data.ok) {
        alert(`Analysis error: ${data.error || "Unknown error"}`);
        return;
      }

      setReport(data.report);

      await loadReportsAndStats();
    } catch (error) {
      console.error(error);
      alert(
        "Backend not reachable. Make sure your Express server is running or Render backend is available."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     COPY
  ========================================================= */

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      alert("Unable to copy SQL.");
    }
  };

  /* =========================================================
     PDF REPORT
  ========================================================= */

  const download = () => {
    if (!report) return;

    const analysis = report.analysis;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    let y = 18;

    const checkPageBreak = (height) => {
      if (y + height > 280) {
        doc.addPage();
        y = 18;
      }
    };

    /* Header */

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);

    doc.text(
      "AI Query Performance Advisor - Optimization Report",
      margin,
      11
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);

    doc.text(
      `Generated: ${new Date().toLocaleString()} | User: ${getDisplayName(
        currentUser
      )}`,
      margin,
      18
    );

    y = 32;

    /* Score */

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);

    doc.roundedRect(
      margin,
      y,
      contentWidth,
      20,
      2,
      2,
      "FD"
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);

    doc.text(
      `Score: ${analysis.performanceScore}/100`,
      margin + 5,
      y + 8
    );

    doc.text(
      `Risk: ${analysis.riskLevel}`,
      margin + 55,
      y + 8
    );

    doc.text(
      `Query Type: ${analysis.queryType}`,
      margin + 110,
      y + 8
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);

    doc.text(
      `Est. Execution Impact: ${
        analysis.executionEstimate || "N/A"
      }`,
      margin + 5,
      y + 15
    );

    y += 26;

    /* SQL */

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);

    doc.text("Submitted SQL Query:", margin, y);

    y += 5;

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(14, 116, 144);

    const sqlLines = doc.splitTextToSize(
      report.sql || "",
      contentWidth
    );

    doc.text(sqlLines, margin, y);

    y += sqlLines.length * 3.8 + 6;

    /* Corrected Query */

    if (analysis.correctedQuery) {
      checkPageBreak(25);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(16, 185, 129);

      doc.text(
        "AI-Recommended Corrected Query:",
        margin,
        y
      );

      y += 5;

      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);

      const correctedLines = doc.splitTextToSize(
        analysis.correctedQuery,
        contentWidth
      );

      doc.text(correctedLines, margin, y);

      y += correctedLines.length * 3.8 + 6;
    }

    /* Findings */

    checkPageBreak(15);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(185, 28, 28);

    doc.text("Identified Bottlenecks:", margin, y);

    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    (analysis.findings || []).forEach((finding) => {
      checkPageBreak(8);

      const line = `• [${finding.severity}] ${finding.title}: ${finding.detail}`;

      const split = doc.splitTextToSize(
        line,
        contentWidth
      );

      doc.text(split, margin, y);

      y += split.length * 4 + 1.5;
    });

    y += 3;

    /* Indexes */

    checkPageBreak(15);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);

    doc.text("Recommended Indexes:", margin, y);

    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    (analysis.indexes || []).forEach((index) => {
      checkPageBreak(8);

      const line = `• Column: ${index.column} (Priority: ${index.priority}) -> ${index.recommendation}`;

      const split = doc.splitTextToSize(
        line,
        contentWidth
      );

      doc.text(split, margin, y);

      y += split.length * 4 + 1.5;
    });

    y += 3;

    /* Optimizations */

    checkPageBreak(15);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);

    doc.text(
      "Optimization Actions for DBA:",
      margin,
      y
    );

    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    (analysis.optimizations || []).forEach(
      (optimization, index) => {
        checkPageBreak(8);

        const split = doc.splitTextToSize(
          `${index + 1}. ${optimization}`,
          contentWidth
        );

        doc.text(split, margin, y);

        y += split.length * 4 + 1.5;
      }
    );

    doc.save(
      `optimization-report-${Date.now()}.pdf`
    );
  };

  /* =========================================================
     ADMIN DATA
  ========================================================= */

  const loadAdminData = async () => {
    if (!currentUser || currentUser.role !== "admin") {
      return;
    }

    const token = getToken();

    if (!token) {
      handleLogout();
      return;
    }

    try {
      setAdminLoading(true);

      const [
        statsResponse,
        usersResponse,
        reportsResponse,
      ] = await Promise.all([
        fetch(`${API}/admin/stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API}/admin/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API}/admin/reports`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (
        statsResponse.status === 401 ||
        usersResponse.status === 401 ||
        reportsResponse.status === 401
      ) {
        alert("Admin session expired.");
        handleLogout();
        return;
      }

      const statsData = await statsResponse.json();
      const usersData = await usersResponse.json();
      const reportsData = await reportsResponse.json();

      if (statsData.ok) {
        setAdminStats(statsData);
      }

      if (usersData.ok) {
        setAdminUsers(
          Array.isArray(usersData.users)
            ? usersData.users
            : []
        );
      }

      if (reportsData.ok) {
        setAdminReports(
          Array.isArray(reportsData.reports)
            ? reportsData.reports
            : []
        );
      }
    } catch (error) {
      console.error("Admin loading error:", error);
    } finally {
      setAdminLoading(false);
    }
  };

  /* =========================================================
     ADMIN SELECT USER
  ========================================================= */

  const loadAdminUserReports = async (email) => {
    if (!email) {
      setSelectedAdminUser("");
      loadAdminData();
      return;
    }

    const token = getToken();

    try {
      setAdminLoading(true);

      const response = await fetch(
        `${API}/admin/users/${encodeURIComponent(
          email
        )}/reports`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.ok) {
        setSelectedAdminUser(email);
        setAdminReports(
          Array.isArray(data.reports)
            ? data.reports
            : []
        );
      }
    } catch (error) {
      console.error(
        "Admin user reports error:",
        error
      );
    } finally {
      setAdminLoading(false);
    }
  };

  /* =========================================================
     ADMIN USER STATS
  ========================================================= */

  const getAdminUserStats = async (email) => {
    if (!email) return null;

    const token = getToken();

    try {
      const response = await fetch(
        `${API}/admin/user-stats/${encodeURIComponent(
          email
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.ok) {
        return data;
      }

      return null;
    } catch {
      return null;
    }
  };

  /* =========================================================
     AUTH SCREENS
  ========================================================= */

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
        onAdminLogin={() => {
          setInitialAuthMode("admin");
          setShowAuth(true);
        }}
      />
    );
  }

  if (!currentUser && showAuth) {
    return (
      <AuthScreen
        initialMode={initialAuthMode}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setShowAuth(false);
        }}
        onBackToWelcome={() => {
          setShowAuth(false);
        }}
      />
    );
  }

  /* =========================================================
     ADMIN UI
  ========================================================= */

  if (currentUser?.role === "admin") {
    return (
      <AdminLayout
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        adminStats={adminStats}
        adminUsers={adminUsers}
        adminReports={adminReports}
        selectedAdminUser={selectedAdminUser}
        setSelectedAdminUser={setSelectedAdminUser}
        loadAdminData={loadAdminData}
        loadAdminUserReports={loadAdminUserReports}
        getAdminUserStats={getAdminUserStats}
        adminLoading={adminLoading}
      />
    );
  }

  /* =========================================================
     USER UI
  ========================================================= */

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f8fafc",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* SIDEBAR */}

      <aside
        style={{
          width: "240px",
          background: "#111827",
          borderRight: "1px solid #1e293b",
          padding: "22px 14px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "9px",
              background: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={21} />
          </div>

          <div>
            <b style={{ fontSize: "16px" }}>
              QueryPilot
            </b>

            <div
              style={{
                fontSize: "10px",
                color: "#64748b",
              }}
            >
              Query Advisor
            </div>
          </div>
        </div>

        <SidebarButton
          active={activeTab === "workbench"}
          icon={<Terminal size={17} />}
          label="SQL Workbench"
          onClick={() => setActiveTab("workbench")}
        />

        <SidebarButton
          active={activeTab === "dashboard"}
          icon={<BarChart3 size={17} />}
          label="My Dashboard"
          onClick={() => setActiveTab("dashboard")}
        />

        <div
          style={{
            marginTop: "auto",
            borderTop: "1px solid #1e293b",
            paddingTop: "15px",
          }}
        >
          <div
            style={{
              padding: "10px",
              fontSize: "11px",
              color: "#64748b",
              marginBottom: "5px",
            }}
          >
            SIGNED IN AS
          </div>

          <div
            style={{
              padding: "10px",
              background: "#0f172a",
              borderRadius: "7px",
              marginBottom: "10px",
              wordBreak: "break-all",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#38bdf8",
              }}
            >
              {getDisplayName(currentUser)}
            </div>

            <div
              style={{
                fontSize: "10px",
                color: "#64748b",
                marginTop: "3px",
              }}
            >
              User Account
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "9px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f87171",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN */}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* TOP BAR */}

        <header
          style={{
            height: "62px",
            borderBottom: "1px solid #1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 30px",
            background: "#0f172a",
          }}
        >
          <div>
            <b style={{ fontSize: "15px" }}>
              {activeTab === "dashboard"
                ? "Health & Workload Dashboard"
                : "SQL Performance Workbench"}
            </b>

            <div
              style={{
                fontSize: "10px",
                color: "#64748b",
                marginTop: "2px",
              }}
            >
              AI-Powered Database Query Performance Advisor
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "11px",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: health
                  ? "#22c55e"
                  : "#ef4444",
              }}
            />

            {health
              ? "MongoDB Connected"
              : "Backend Offline"}
          </div>
        </header>

        {activeTab === "dashboard" ? (
          <DashboardView
            stats={stats}
            reports={reports}
            refreshing={refreshing}
            onRefresh={loadReportsAndStats}
            onSelectQuery={(query) => {
              setSql(query);
              setActiveTab("workbench");
            }}
          />
        ) : (
          <main
            style={{
              padding: "28px 36px",
              maxWidth: "1250px",
              width: "100%",
              boxSizing: "border-box",
              margin: "0 auto",
            }}
          >
            {/* HERO */}

            <section
              className="hero"
              style={{
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  marginBottom: "20px",
                }}
              >
                <h1
                  style={{
                    fontSize: "28px",
                    margin: "0 0 8px",
                  }}
                >
                  Analyze Your SQL Queries
                </h1>

                <p
                  style={{
                    color: "#94a3b8",
                    margin: 0,
                    maxWidth: "700px",
                    lineHeight: 1.6,
                  }}
                >
                  Detect inefficient joins, missing indexes,
                  subqueries, sorting issues and other SQL
                  performance bottlenecks.
                </p>
              </div>

              <div
                className="heroStats"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(180px,1fr))",
                  gap: "12px",
                }}
              >
                <div
                  onClick={() =>
                    setSql(SAMPLE_EXPLAINABLE)
                  }
                  style={{
                    cursor: "pointer",
                    border: "1px solid #334155",
                    userSelect: "none",
                    padding: "16px",
                    borderRadius: "8px",
                    background: "#111827",
                    display: "flex",
                    flexDirection: "column",
                    gap: "7px",
                  }}
                  title="Click to load Explainable AI sample query"
                >
                  <Activity color="#38bdf8" />
                  <b>Explainable AI</b>
                  <small style={{ color: "#64748b" }}>
                    Rule-based analysis
                  </small>
                </div>

                <div
                  onClick={() => setSql(SAMPLE_DBA)}
                  style={{
                    cursor: "pointer",
                    border: "1px solid #334155",
                    userSelect: "none",
                    padding: "16px",
                    borderRadius: "8px",
                    background: "#111827",
                    display: "flex",
                    flexDirection: "column",
                    gap: "7px",
                  }}
                  title="Click to load DBA index sample query"
                >
                  <ShieldCheck color="#10b981" />
                  <b>DBA Ready</b>
                  <small style={{ color: "#64748b" }}>
                    Index recommendations
                  </small>
                </div>

                <div
                  onClick={() => setSql(SAMPLE_MEDIUM)}
                  style={{
                    cursor: "pointer",
                    border: "1px solid #334155",
                    userSelect: "none",
                    padding: "16px",
                    borderRadius: "8px",
                    background: "#111827",
                    display: "flex",
                    flexDirection: "column",
                    gap: "7px",
                  }}
                  title="Click to load Medium Risk query"
                >
                  <Gauge color="#f59e0b" />
                  <b>Medium Risk</b>
                  <small style={{ color: "#64748b" }}>
                    Aggregation test
                  </small>
                </div>

                <div
                  onClick={() =>
                    setSql(SAMPLE_SUBQUERY)
                  }
                  style={{
                    cursor: "pointer",
                    border: "1px solid #334155",
                    userSelect: "none",
                    padding: "16px",
                    borderRadius: "8px",
                    background: "#111827",
                    display: "flex",
                    flexDirection: "column",
                    gap: "7px",
                  }}
                  title="Click to load Nested Subquery test"
                >
                  <Layers color="#a855f7" />
                  <b>Subquery Test</b>
                  <small style={{ color: "#64748b" }}>
                    IN sub-loop check
                  </small>
                </div>
              </div>
            </section>

            {/* QUERY + PERFORMANCE */}

            <section
              className="layout"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(350px,1fr))",
                gap: "16px",
              }}
            >
              <div className="card editor">
                <div className="head">
                  <div>
                    <h2>SQL Query</h2>
                    <small>
                      Paste a query for analysis
                    </small>
                  </div>

                  <button
                    onClick={() =>
                      setSql(SAMPLE_DEFAULT)
                    }
                  >
                    Load Default Sample
                  </button>
                </div>

                <textarea
                  value={sql}
                  onChange={(e) =>
                    setSql(e.target.value)
                  }
                  rows={10}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#020617",
                    color: "#38bdf8",
                    border: "1px solid #334155",
                    borderRadius: "7px",
                    padding: "14px",
                    fontFamily:
                      "Consolas, Monaco, monospace",
                    resize: "vertical",
                    outline: "none",
                  }}
                />

                <div
                  className="actions"
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "12px",
                  }}
                >
                  <button
                    className="primary"
                    onClick={analyze}
                    disabled={loading}
                  >
                    {loading
                      ? "Analyzing..."
                      : "Analyze Query →"}
                  </button>

                  <button
                    onClick={() => setSql("")}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="head">
                  <div>
                    <h2>
                      Performance Overview
                    </h2>
                    <small>
                      Static analysis result
                    </small>
                  </div>

                  {report && (
                    <span
                      className={
                        "pill " +
                        getRiskClass(
                          report.analysis.riskLevel
                        )
                      }
                    >
                      {report.analysis.riskLevel} Risk
                    </span>
                  )}
                </div>

                {report ? (
                  <>
                    <div
                      className="scoreRow"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "18px",
                        margin: "20px 0",
                      }}
                    >
                      <div
                        className="score"
                        style={{
                          fontSize: "48px",
                          fontWeight: "800",
                          color: "#38bdf8",
                        }}
                      >
                        {
                          report.analysis
                            .performanceScore
                        }
                      </div>

                      <div>
                        <b>
                          Performance Score / 100
                        </b>

                        <p
                          style={{
                            color: "#94a3b8",
                          }}
                        >
                          {
                            report.analysis
                              .executionEstimate
                          }
                        </p>
                      </div>
                    </div>

                    <div
                      className="metrics"
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(2,1fr)",
                        gap: "10px",
                      }}
                    >
                      <Metric
                        n="Query Type"
                        v={
                          report.analysis
                            .queryType
                        }
                      />

                      <Metric
                        n="Joins"
                        v={
                          report.analysis.metrics
                            ?.joins || 0
                        }
                      />

                      <Metric
                        n="Filters"
                        v={
                          report.analysis.metrics
                            ?.filters || 0
                        }
                      />

                      <Metric
                        n="Functions"
                        v={
                          report.analysis.metrics
                            ?.functions || 0
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="empty">
                    Run an analysis to see
                    performance metrics.
                  </div>
                )}
              </div>
            </section>

            {/* CORRECTED QUERY */}

            {report?.analysis?.correctedQuery && (
              <section
                className="card"
                style={{
                  marginTop: "16px",
                  border: "1px solid #059669",
                  background:
                    "linear-gradient(180deg,#064e3b15 0%,transparent 100%)",
                }}
              >
                <div className="head">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        background: "#059669",
                        padding: "6px",
                        borderRadius: "6px",
                        display: "flex",
                      }}
                    >
                      <Wand2
                        size={16}
                        color="#ffffff"
                      />
                    </div>

                    <div>
                      <h2
                        style={{
                          color: "#34d399",
                          margin: 0,
                        }}
                      >
                        AI-Recommended Corrected
                        Query
                      </h2>

                      <small>
                        Optimized query alternative
                      </small>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <button
                      onClick={() =>
                        copyToClipboard(
                          report.analysis
                            .correctedQuery
                        )
                      }
                    >
                      {copied ? (
                        <CheckCheck size={14} />
                      ) : (
                        <Copy size={14} />
                      )}

                      {copied
                        ? "Copied!"
                        : "Copy SQL"}
                    </button>

                    <button
                      onClick={() =>
                        setSql(
                          report.analysis
                            .correctedQuery
                        )
                      }
                    >
                      <Zap size={14} /> Apply
                    </button>
                  </div>
                </div>

                <pre
                  style={{
                    background: "#0f172a",
                    padding: "16px",
                    borderRadius: "6px",
                    color: "#38bdf8",
                    fontFamily:
                      "Consolas, Monaco, monospace",
                    fontSize: "13.5px",
                    overflowX: "auto",
                    lineHeight: "1.6",
                    margin: "12px 0",
                    border: "1px solid #1e293b",
                  }}
                >
                  {report.analysis.correctedQuery}
                </pre>
              </section>
            )}

            {/* FINDINGS */}

            {report && (
              <>
                <section
                  className="layout lower"
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(350px,1fr))",
                    gap: "16px",
                    marginTop: "16px",
                  }}
                >
                  <Panel
                    title="Performance Bottlenecks"
                    icon={<TriangleAlert />}
                  >
                    {(report.analysis.findings ||
                      []).map((finding, index) => (
                      <div
                        className="finding"
                        key={index}
                        style={{
                          padding: "12px 0",
                          borderBottom:
                            "1px solid #1e293b",
                        }}
                      >
                        <span
                          style={{
                            color: "#f59e0b",
                            fontSize: "11px",
                            fontWeight: "bold",
                          }}
                        >
                          {finding.severity}
                        </span>

                        <b
                          style={{
                            display: "block",
                            marginTop: "4px",
                          }}
                        >
                          {finding.title}
                        </b>

                        <p
                          style={{
                            color: "#94a3b8",
                            fontSize: "13px",
                          }}
                        >
                          {finding.detail}
                        </p>
                      </div>
                    ))}
                  </Panel>

                  <Panel
                    title="Index Recommendations"
                    icon={<Database />}
                  >
                    {(report.analysis.indexes ||
                      []).map((index, i) => (
                      <div
                        className="index"
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: "10px",
                          padding: "12px 0",
                          borderBottom:
                            "1px solid #1e293b",
                        }}
                      >
                        <div>
                          <b>{index.column}</b>

                          <p
                            style={{
                              color: "#94a3b8",
                              fontSize: "13px",
                            }}
                          >
                            {index.recommendation}
                          </p>
                        </div>

                        <span
                          style={{
                            color: "#38bdf8",
                            fontSize: "11px",
                          }}
                        >
                          {index.priority}
                        </span>
                      </div>
                    ))}
                  </Panel>
                </section>

                {/* OPTIMIZATIONS */}

                <section
                  className="card"
                  style={{
                    marginTop: "16px",
                  }}
                >
                  <div className="head">
                    <div>
                      <h2>
                        Optimization
                        Recommendations
                      </h2>

                      <small>
                        Recommended actions for
                        the DBA
                      </small>
                    </div>

                    <button onClick={download}>
                      <Download size={15} />
                      Export PDF Report
                    </button>
                  </div>

                  <ol>
                    {(
                      report.analysis
                        .optimizations || []
                    ).map((optimization, i) => (
                      <li key={i}>
                        {optimization}
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )}

            {/* USER HISTORY */}

            <section
              className="card history"
              style={{
                marginTop: "16px",
              }}
            >
              <div className="head">
                <div>
                  <h2>Recent Reports</h2>

                  <small>
                    Scoped to{" "}
                    {getDisplayName(currentUser)}
                  </small>
                </div>

                <button
                  onClick={loadReportsAndStats}
                  disabled={refreshing}
                >
                  <RefreshCw
                    size={15}
                    className={
                      refreshing
                        ? "animate-spin"
                        : ""
                    }
                  />

                  {refreshing
                    ? "Refreshing..."
                    : "Refresh"}
                </button>
              </div>

              {reports.length ? (
                reports.map((item, index) => (
                  <div
                    className="historyRow"
                    key={
                      item._id ||
                      item.createdAt ||
                      index
                    }
                    style={{
                      padding: "12px 0",
                      borderBottom:
                        "1px solid #1e293b",
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "15px",
                    }}
                  >
                    <b>{item.title}</b>

                    <span
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                      }}
                    >
                      {new Date(
                        item.createdAt
                      ).toLocaleString()}{" "}
                      • Score{" "}
                      {item.analysis
                        ?.performanceScore || 0}
                      /100
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty">
                  No saved reports found for
                  your account.
                </div>
              )}
            </section>
          </main>
        )}

        <footer
          style={{
            marginTop: "auto",
            padding: "16px 36px",
            color: "#64748b",
            fontSize: "11px",
            borderTop: "1px solid #1e293b",
          }}
        >
          MongoDB • Express.js • React.js • Node.js
          {" | "}
          AI-Powered Database Query Performance
          Advisor
        </footer>
      </div>
    </div>
  );
}

/* =========================================================
   SIDEBAR BUTTON
========================================================= */

function SidebarButton({
  active,
  icon,
  label,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "11px 12px",
        marginBottom: "5px",
        borderRadius: "7px",
        border: active
          ? "1px solid #2563eb"
          : "1px solid transparent",
        background: active
          ? "#172554"
          : "transparent",
        color: active
          ? "#ffffff"
          : "#94a3b8",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* =========================================================
   WELCOME SCREEN
========================================================= */

function WelcomeScreen({
  onGetStarted,
  onRegister,
  onAdminLogin,
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1325",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: "#f8fafc",
        fontFamily:
          "system-ui, -apple-system, sans-serif",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
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
            <Zap size={22} />
          </div>

          <div>
            <h1
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                margin: 0,
              }}
            >
              QueryPilot
            </h1>

            <span
              style={{
                fontSize: "11px",
                color: "#64748b",
              }}
            >
              Query Performance Advisor
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <button onClick={onGetStarted}>
            Sign In
          </button>

          <button
            onClick={onRegister}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "7px",
              cursor: "pointer",
            }}
          >
            Get Started Free
          </button>

          <button
            onClick={onAdminLogin}
            style={{
              background: "#1e293b",
              color: "#cbd5e1",
              border: "1px solid #334155",
              padding: "8px 16px",
              borderRadius: "7px",
              cursor: "pointer",
            }}
          >
            Admin Login
          </button>
        </div>
      </header>

      <main
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          padding: "60px 24px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "44px",
            fontWeight: 800,
            margin: "0 0 18px",
          }}
        >
          Welcome to{" "}
          <span style={{ color: "#38bdf8" }}>
            Query Advisor
          </span>
        </h1>

        <p
          style={{
            fontSize: "16px",
            color: "#94a3b8",
            maxWidth: "680px",
            margin: "0 auto 36px",
            lineHeight: 1.7,
          }}
        >
          Diagnose database bottlenecks,
          identify indexing opportunities,
          analyze SQL queries and generate
          optimization reports.
        </p>

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
      </main>

      <footer
        style={{
          borderTop: "1px solid #1e293b",
          padding: "20px 48px",
          textAlign: "center",
          fontSize: "12px",
          color: "#64748b",
        }}
      >
        QueryPilot • Full-Stack Query Performance
        Advisor
      </footer>
    </div>
  );
}

/* =========================================================
   AUTH SCREEN
========================================================= */

function AuthScreen({
  initialMode = "login",
  onLoginSuccess,
  onBackToWelcome,
}) {
  const [mode, setMode] = useState(
    initialMode === "admin"
      ? "admin"
      : initialMode
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";
  const isAdmin = mode === "admin";

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password.trim()) {
      setError(
        "Enter email and password."
      );
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const response = await fetch(
          `${API}/auth/register`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email: email.trim(),
              password,
            }),
          }
        );

        const data =
          await response.json();

        if (!data.ok) {
          setError(
            data.error ||
              "Registration failed."
          );
          return;
        }

        localStorage.setItem(
          "advisor_token",
          data.token
        );

        localStorage.setItem(
          "advisor_user",
          JSON.stringify(data.user)
        );

        onLoginSuccess(data.user);

        return;
      }

      /* LOGIN */

      const response = await fetch(
        `${API}/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!data.ok) {
        setError(
          data.error ||
            "Invalid email or password."
        );
        return;
      }

      /*
        Extra frontend check:
        Admin Login screen should only
        accept admin account.
      */

      if (
        isAdmin &&
        data.user.role !== "admin"
      ) {
        setError(
          "This is not an administrator account."
        );
        return;
      }

      /*
        Normal login screen should not
        enter admin dashboard.
      */

      if (
        !isAdmin &&
        data.user.role === "admin"
      ) {
        setError(
          "Please use Admin Login for administrator access."
        );
        return;
      }

      localStorage.setItem(
        "advisor_token",
        data.token
      );

      localStorage.setItem(
        "advisor_user",
        JSON.stringify(data.user)
      );

      onLoginSuccess(data.user);
    } catch (error) {
      console.error(error);

      setError(
        "Cannot connect to backend. Check your API/server."
      );
    } finally {
      setLoading(false);
    }
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
          maxWidth: "410px",
          border: "1px solid #334155",
          color: "#f8fafc",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            {isAdmin ? (
              <ShieldCheck
                size={23}
                color="#10b981"
              />
            ) : (
              <Zap
                size={23}
                color="#3b82f6"
              />
            )}

            <h2
              style={{
                margin: 0,
                fontSize: "20px",
              }}
            >
              QueryPilot
            </h2>
          </div>

          <button
            onClick={onBackToWelcome}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "6px",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #334155",
              background:
                mode === "login"
                  ? "#2563eb"
                  : "#0f172a",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            User Login
          </button>

          <button
            onClick={() => setMode("register")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #334155",
              background:
                mode === "register"
                  ? "#2563eb"
                  : "#0f172a",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Register
          </button>

          <button
            onClick={() => setMode("admin")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #334155",
              background:
                mode === "admin"
                  ? "#059669"
                  : "#0f172a",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Admin
          </button>
        </div>

        <h3
          style={{
            margin: "0 0 16px",
            fontSize: "17px",
          }}
        >
          {isRegister
            ? "Create User Account"
            : isAdmin
            ? "Administrator Login"
            : "User Login"}
        </h3>

        {isAdmin && (
          <div
            style={{
              background: "#064e3b",
              border: "1px solid #047857",
              color: "#a7f3d0",
              padding: "10px",
              borderRadius: "6px",
              fontSize: "12px",
              marginBottom: "14px",
            }}
          >
            Administrator access is restricted
            to the two configured admin accounts.
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#450a0a",
              color: "#f87171",
              padding: "10px",
              borderRadius: "6px",
              fontSize: "13px",
              marginBottom: "14px",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              Email
            </label>

            <input
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                background: "#0f172a",
                border: "1px solid #475569",
                color: "#ffffff",
                boxSizing: "border-box",
              }}
            />
          </div>

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

            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                background: "#0f172a",
                border: "1px solid #475569",
                color: "#ffffff",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "8px",
              padding: "11px",
              background: isAdmin
                ? "#059669"
                : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Please wait..."
              : isRegister
              ? "Create Account →"
              : isAdmin
              ? "Admin Sign In →"
              : "Sign In →"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   USER DASHBOARD
========================================================= */

function DashboardView({
  stats,
  reports,
  refreshing,
  onRefresh,
  onSelectQuery,
}) {
  const [searchTerm, setSearchTerm] =
    useState("");

  const highRiskCount =
    stats.highRisk ||
    reports.filter(
      (report) =>
        report.analysis?.riskLevel ===
        "High"
    ).length;

  const filteredReports =
    reports.filter((report) =>
      (report.sql || "")
        .toLowerCase()
        .includes(
          searchTerm.toLowerCase()
        )
    );

  return (
    <main
      style={{
        padding: "28px 36px",
        maxWidth: "1200px",
        width: "100%",
        boxSizing: "border-box",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1
            style={{
              margin: "0 0 6px",
              fontSize: "22px",
            }}
          >
            Health & Workload Dashboard
          </h1>

          <p
            style={{
              margin: 0,
              color: "#94a3b8",
              fontSize: "14px",
            }}
          >
            Your personal query performance
            history
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            size={14}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh Stats"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <DashboardCard
          title="Total Queries"
          value={
            stats.total ||
            reports.length
          }
          icon={
            <Layers
              color="#38bdf8"
              size={24}
            />
          }
          detail="Your analyzed queries"
        />

        <DashboardCard
          title="Average Score"
          value={`${stats.averageScore || 0} / 100`}
          icon={
            <Gauge
              color="#10b981"
              size={24}
            />
          }
          detail="Your average score"
        />

        <DashboardCard
          title="High Risk"
          value={highRiskCount}
          icon={
            <ShieldAlert
              color="#ef4444"
              size={24}
            />
          }
          detail="Queries requiring attention"
        />
      </div>

      <div
        className="card"
        style={{ padding: "20px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            marginBottom: "16px",
            gap: "10px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
            }}
          >
            Query Workload History
          </h3>

          <input
            type="text"
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "4px",
              padding: "7px 10px",
              fontSize: "12px",
              color: "#f8fafc",
            }}
          />
        </div>

        <div
          style={{
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              fontSize: "13px",
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom:
                    "1px solid #334155",
                  color: "#94a3b8",
                }}
              >
                <th
                  style={{
                    padding: "8px 10px",
                  }}
                >
                  SQL
                </th>

                <th
                  style={{
                    padding: "8px 10px",
                  }}
                >
                  Score
                </th>

                <th
                  style={{
                    padding: "8px 10px",
                  }}
                >
                  Risk
                </th>

                <th
                  style={{
                    padding: "8px 10px",
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredReports
                .slice(0, 20)
                .map((item, index) => (
                  <tr
                    key={
                      item._id ||
                      item.createdAt ||
                      index
                    }
                    style={{
                      borderBottom:
                        "1px solid #1e293b",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px",
                        fontFamily:
                          "monospace",
                        color: "#38bdf8",
                        maxWidth: "350px",
                        overflow: "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {item.sql}
                    </td>

                    <td
                      style={{
                        padding: "10px",
                        fontWeight:
                          "bold",
                      }}
                    >
                      {item.analysis
                        ?.performanceScore ||
                        0}
                    </td>

                    <td
                      style={{
                        padding: "10px",
                      }}
                    >
                      <span
                        className={
                          "pill " +
                          getRiskClass(
                            item.analysis
                              ?.riskLevel
                          )
                        }
                      >
                        {item.analysis
                          ?.riskLevel ||
                          "Low"}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "10px",
                      }}
                    >
                      <button
                        onClick={() =>
                          onSelectQuery(
                            item.sql
                          )
                        }
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

/* =========================================================
   ADMIN LAYOUT
========================================================= */

function AdminLayout({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
  adminStats,
  adminUsers,
  adminReports,
  selectedAdminUser,
  setSelectedAdminUser,
  loadAdminData,
  loadAdminUserReports,
  getAdminUserStats,
  adminLoading,
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f8fafc",
        display: "flex",
        fontFamily:
          "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ADMIN SIDEBAR */}

      <aside
        style={{
          width: "245px",
          background: "#111827",
          borderRight:
            "1px solid #1e293b",
          padding: "22px 14px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "9px",
              background: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck size={21} />
          </div>

          <div>
            <b>QueryPilot</b>

            <div
              style={{
                fontSize: "10px",
                color: "#64748b",
              }}
            >
              Admin Console
            </div>
          </div>
        </div>

        <SidebarButton
          active={activeTab === "admin-dashboard"}
          icon={<BarChart3 size={17} />}
          label="Admin Dashboard"
          onClick={() =>
            setActiveTab("admin-dashboard")
          }
        />

        <SidebarButton
          active={activeTab === "admin-users"}
          icon={<Users size={17} />}
          label="All Users"
          onClick={() =>
            setActiveTab("admin-users")
          }
        />

        <SidebarButton
          active={activeTab === "admin-reports"}
          icon={<FileText size={17} />}
          label="All Reports"
          onClick={() =>
            setActiveTab("admin-reports")
          }
        />

        <div
          style={{
            marginTop: "auto",
            borderTop:
              "1px solid #1e293b",
            paddingTop: "15px",
          }}
        >
          <div
            style={{
              padding: "10px",
              background: "#0f172a",
              borderRadius: "7px",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#34d399",
              }}
            >
              ADMIN
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "#cbd5e1",
                marginTop: "3px",
                wordBreak:
                  "break-all",
              }}
            >
              {currentUser.email}
            </div>
          </div>

          <button
            onClick={onLogout}
            style={{
              width: "100%",
              padding: "9px",
              display: "flex",
              justifyContent:
                "center",
              alignItems: "center",
              gap: "7px",
              background: "#1e293b",
              border:
                "1px solid #334155",
              color: "#f87171",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>

      {/* ADMIN MAIN */}

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "28px 36px",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            marginBottom: "25px",
          }}
        >
          <div>
            <h1
              style={{
                margin: "0 0 5px",
                fontSize: "24px",
              }}
            >
              {activeTab ===
              "admin-users"
                ? "User Management"
                : activeTab ===
                  "admin-reports"
                ? "Report Monitoring"
                : "Admin Dashboard"}
            </h1>

            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              Monitor users, SQL analysis
              and generated reports
            </p>
          </div>

          <button
            onClick={loadAdminData}
            disabled={adminLoading}
          >
            <RefreshCw
              size={15}
              className={
                adminLoading
                  ? "animate-spin"
                  : ""
              }
            />

            {adminLoading
              ? "Loading..."
              : "Refresh"}
          </button>
        </div>

        {activeTab ===
          "admin-dashboard" && (
          <AdminDashboard
            stats={adminStats}
            users={adminUsers}
            reports={adminReports}
            onSelectUser={(email) => {
              setSelectedAdminUser(
                email
              );
              loadAdminUserReports(
                email
              );
              setActiveTab(
                "admin-reports"
              );
            }}
          />
        )}

        {activeTab === "admin-users" && (
          <AdminUsers
            users={adminUsers}
            reports={adminReports}
            onSelectUser={(email) => {
              setSelectedAdminUser(
                email
              );

              loadAdminUserReports(
                email
              );

              setActiveTab(
                "admin-reports"
              );
            }}
          />
        )}

        {activeTab ===
          "admin-reports" && (
          <AdminReports
            reports={adminReports}
            users={adminUsers}
            selectedUser={
              selectedAdminUser
            }
            onSelectUser={(email) => {
              setSelectedAdminUser(
                email
              );

              loadAdminUserReports(
                email
              );
            }}
            onShowAll={() => {
              setSelectedAdminUser("");
              loadAdminData();
            }}
          />
        )}
      </main>
    </div>
  );
}

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

function AdminDashboard({
  stats,
  users,
  reports,
  onSelectUser,
}) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(200px,1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <AdminStatCard
          title="Total Users"
          value={stats.totalUsers || 0}
          icon={<Users />}
        />

        <AdminStatCard
          title="Total Reports"
          value={stats.totalReports || 0}
          icon={<FileText />}
        />

        <AdminStatCard
          title="Average Score"
          value={`${stats.averageScore || 0}/100`}
          icon={<Gauge />}
        />

        <AdminStatCard
          title="High Risk"
          value={stats.highRisk || 0}
          icon={<ShieldAlert />}
        />

        <AdminStatCard
          title="Medium Risk"
          value={stats.mediumRisk || 0}
          icon={<TriangleAlert />}
        />

        <AdminStatCard
          title="Low Risk"
          value={stats.lowRisk || 0}
          icon={<ShieldCheck />}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(350px,1fr))",
          gap: "16px",
        }}
      >
        <div
          className="card"
          style={{ padding: "20px" }}
        >
          <div className="head">
            <div>
              <h2>Registered Users</h2>
              <small>
                Users registered in the
                application
              </small>
            </div>
          </div>

          {users.length === 0 ? (
            <div className="empty">
              No users found.
            </div>
          ) : (
            users.slice(0, 10).map((user) => (
              <div
                key={user._id}
                style={{
                  padding: "12px 0",
                  borderBottom:
                    "1px solid #1e293b",
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div>
                  <b>{user.email}</b>

                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "11px",
                      marginTop: "3px",
                    }}
                  >
                    Created{" "}
                    {user.createdAt
                      ? new Date(
                          user.createdAt
                        ).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>

                <button
                  onClick={() =>
                    onSelectUser(
                      user.email
                    )
                  }
                >
                  View
                </button>
              </div>
            ))
          )}
        </div>

        <div
          className="card"
          style={{ padding: "20px" }}
        >
          <div className="head">
            <div>
              <h2>Recent Reports</h2>
              <small>
                Latest user SQL analysis
              </small>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="empty">
              No reports found.
            </div>
          ) : (
            reports
              .slice(0, 10)
              .map((report, index) => (
                <div
                  key={
                    report._id ||
                    index
                  }
                  style={{
                    padding: "12px 0",
                    borderBottom:
                      "1px solid #1e293b",
                  }}
                >
                  <b>
                    {report.userEmail}
                  </b>

                  <div
                    style={{
                      fontSize: "12px",
                      color: "#38bdf8",
                      marginTop: "4px",
                      fontFamily:
                        "monospace",
                      overflow: "hidden",
                      textOverflow:
                        "ellipsis",
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    {report.sql}
                  </div>

                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "11px",
                      marginTop: "4px",
                    }}
                  >
                    Score:{" "}
                    {report.analysis
                      ?.performanceScore ||
                      0}
                    /100
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </>
  );
}

/* =========================================================
   ADMIN USERS
========================================================= */

function AdminUsers({
  users,
  reports,
  onSelectUser,
}) {
  const [search, setSearch] =
    useState("");

  const filteredUsers =
    users.filter((user) =>
      user.email
        ?.toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  return (
    <div
      className="card"
      style={{ padding: "20px" }}
    >
      <div className="head">
        <div>
          <h2>All Users</h2>
          <small>
            Monitor registered user
            accounts
          </small>
        </div>

        <input
          placeholder="Search user email..."
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          style={{
            background: "#0f172a",
            border:
              "1px solid #334155",
            color: "#fff",
            padding: "8px 10px",
            borderRadius: "6px",
          }}
        />
      </div>

      <div
        style={{
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse:
              "collapse",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom:
                  "1px solid #334155",
                textAlign: "left",
                color: "#94a3b8",
              }}
            >
              <th
                style={{
                  padding: "12px",
                }}
              >
                Email
              </th>

              <th
                style={{
                  padding: "12px",
                }}
              >
                Role
              </th>

              <th
                style={{
                  padding: "12px",
                }}
              >
                Created
              </th>

              <th
                style={{
                  padding: "12px",
                }}
              >
                Reports
              </th>

              <th
                style={{
                  padding: "12px",
                }}
              >
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map(
              (user) => {
                const reportCount =
                  reports.filter(
                    (report) =>
                      report.userEmail ===
                      user.email
                  ).length;

                return (
                  <tr
                    key={user._id}
                    style={{
                      borderBottom:
                        "1px solid #1e293b",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px",
                      }}
                    >
                      {user.email}
                    </td>

                    <td
                      style={{
                        padding: "12px",
                      }}
                    >
                      <span
                        style={{
                          color:
                            "#38bdf8",
                        }}
                      >
                        User
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "12px",
                        color:
                          "#94a3b8",
                      }}
                    >
                      {user.createdAt
                        ? new Date(
                            user.createdAt
                          ).toLocaleString()
                        : "N/A"}
                    </td>

                    <td
                      style={{
                        padding: "12px",
                      }}
                    >
                      {reportCount}
                    </td>

                    <td
                      style={{
                        padding: "12px",
                      }}
                    >
                      <button
                        onClick={() =>
                          onSelectUser(
                            user.email
                          )
                        }
                      >
                        View Reports
                      </button>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN REPORTS
========================================================= */

function AdminReports({
  reports,
  users,
  selectedUser,
  onSelectUser,
  onShowAll,
}) {
  const [search, setSearch] =
    useState("");

  const filteredReports =
    reports.filter((report) => {
      const text = `
        ${report.userEmail || ""}
        ${report.sql || ""}
        ${report.title || ""}
        ${report.analysis?.riskLevel || ""}
      `.toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    });

  return (
    <>
      <div
        className="card"
        style={{
          padding: "20px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <select
            value={selectedUser}
            onChange={(event) =>
              onSelectUser(
                event.target.value
              )
            }
            style={{
              background: "#0f172a",
              color: "#fff",
              border:
                "1px solid #334155",
              padding: "9px 12px",
              borderRadius: "6px",
            }}
          >
            <option value="">
              Select User
            </option>

            {users.map((user) => (
              <option
                key={user._id}
                value={user.email}
              >
                {user.email}
              </option>
            ))}
          </select>

          <button onClick={onShowAll}>
            Show All Users
          </button>

          <input
            placeholder="Search reports..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            style={{
              flex: 1,
              minWidth: "220px",
              background:
                "#0f172a",
              color: "#fff",
              border:
                "1px solid #334155",
              padding: "9px 12px",
              borderRadius: "6px",
            }}
          />
        </div>
      </div>

      <div
        className="card"
        style={{ padding: "20px" }}
      >
        <div className="head">
          <div>
            <h2>
              {selectedUser
                ? `Reports: ${selectedUser}`
                : "All User Reports"}
            </h2>

            <small>
              Administrator monitoring
              view
            </small>
          </div>

          <span
            style={{
              color: "#38bdf8",
              fontSize: "12px",
            }}
          >
            {filteredReports.length} reports
          </span>
        </div>

        {filteredReports.length ===
        0 ? (
          <div className="empty">
            No reports found.
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom:
                      "1px solid #334155",
                    textAlign:
                      "left",
                    color:
                      "#94a3b8",
                  }}
                >
                  <th
                    style={{
                      padding: "10px",
                    }}
                  >
                    User
                  </th>

                  <th
                    style={{
                      padding: "10px",
                    }}
                  >
                    SQL Query
                  </th>

                  <th
                    style={{
                      padding: "10px",
                    }}
                  >
                    Score
                  </th>

                  <th
                    style={{
                      padding: "10px",
                    }}
                  >
                    Risk
                  </th>

                  <th
                    style={{
                      padding: "10px",
                    }}
                  >
                    Date
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredReports.map(
                  (report, index) => (
                    <tr
                      key={
                        report._id ||
                        index
                      }
                      style={{
                        borderBottom:
                          "1px solid #1e293b",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px",
                          color:
                            "#cbd5e1",
                        }}
                      >
                        {report.userEmail}
                      </td>

                      <td
                        style={{
                          padding: "10px",
                          maxWidth:
                            "400px",
                          fontFamily:
                            "monospace",
                          color:
                            "#38bdf8",
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {report.sql}
                      </td>

                      <td
                        style={{
                          padding: "10px",
                          fontWeight:
                            "bold",
                        }}
                      >
                        {report.analysis
                          ?.performanceScore ||
                          0}
                        /100
                      </td>

                      <td
                        style={{
                          padding: "10px",
                        }}
                      >
                        <span
                          className={
                            "pill " +
                            getRiskClass(
                              report
                                .analysis
                                ?.riskLevel
                            )
                          }
                        >
                          {report.analysis
                            ?.riskLevel ||
                            "Low"}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: "10px",
                          color:
                            "#94a3b8",
                        }}
                      >
                        {report.createdAt
                          ? new Date(
                              report.createdAt
                            ).toLocaleString()
                          : "N/A"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* =========================================================
   ADMIN STAT CARD
========================================================= */

function AdminStatCard({
  title,
  value,
  icon,
}) {
  return (
    <div
      className="card"
      style={{
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: "#94a3b8",
            fontSize: "12px",
          }}
        >
          {title}
        </span>

        <div
          style={{
            color: "#38bdf8",
          }}
        >
          {icon}
        </div>
      </div>

      <div
        style={{
          fontSize: "27px",
          fontWeight: "800",
          marginTop: "12px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* =========================================================
   DASHBOARD CARD
========================================================= */

function DashboardCard({
  title,
  value,
  icon,
  detail,
}) {
  return (
    <div
      className="card"
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: "#94a3b8",
          }}
        >
          {title}
        </span>

        {icon}
      </div>

      <div
        style={{
          fontSize: "24px",
          fontWeight: "bold",
        }}
      >
        {value}
      </div>

      <small
        style={{
          color: "#64748b",
          fontSize: "11px",
        }}
      >
        {detail}
      </small>
    </div>
  );
}

/* =========================================================
   METRIC
========================================================= */

function Metric({ n, v }) {
  return (
    <div
      style={{
        background: "#0f172a",
        border:
          "1px solid #1e293b",
        padding: "10px",
        borderRadius: "6px",
      }}
    >
      <small
        style={{
          display: "block",
          color: "#64748b",
          fontSize: "10px",
        }}
      >
        {n}
      </small>

      <b
        style={{
          display: "block",
          marginTop: "3px",
        }}
      >
        {v}
      </b>
    </div>
  );
}

/* =========================================================
   PANEL
========================================================= */

function Panel({
  title,
  icon,
  children,
}) {
  return (
    <div className="card">
      <div className="head">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {icon}

          <div>
            <h2>{title}</h2>

            <small>
              Detected by analysis engine
            </small>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}