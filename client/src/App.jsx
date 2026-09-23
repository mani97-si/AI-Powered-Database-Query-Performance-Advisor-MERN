import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CheckCheck,
  ChevronRight,
  Copy,
  Database,
  Download,
  Gauge,
  Layers,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  TrendingDown,
  TriangleAlert,
  Wand2,
  Zap,
} from "lucide-react";

const API = "https://ai-powered-database-query-performance.onrender.com/api";
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

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return localStorage.getItem("advisor_user") || null;
    } catch {
      return null;
    }
  });

  const [showAuth, setShowAuth] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState("login");
  const [activeTab, setActiveTab] = useState("workbench");
  const [sql, setSql] = useState(SAMPLE_DEFAULT);
  const [report, setReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ total: 0, averageScore: 0, highRisk: 0 });
  const [health, setHealth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const getStorageKey = (prefix) => {
    const user = getDisplayName(currentUser);
    return `${prefix}_${String(user).toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("advisor_token");
      localStorage.removeItem("advisor_user");
    } catch (e) {
      console.warn("Storage reset error", e);
    }
    setCurrentUser(null);
    setReport(null);
    setReports([]);
    setStats({ total: 0, averageScore: 0, highRisk: 0 });
    setShowAuth(false);
  };

  const loadReportsAndStats = async () => {
    if (!currentUser) return;
    const userParam = encodeURIComponent(getDisplayName(currentUser));
    const localReportsKey = getStorageKey("advisor_reports");
    const localStatsKey = getStorageKey("advisor_stats");

    // Safe retrieval preventing mobile browser JSON crash
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
        fetch(`${API}/reports?userEmail=${userParam}`),
        fetch(`${API}/stats?userEmail=${userParam}`),
      ]);

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
      console.warn("Syncing offline per-user store.");
    } finally {
      setRefreshing(false);
    }
  };

  const checkHealth = async () => {
    try {
      const r = await fetch(`${API}/health`);
      const d = await r.json();
      setHealth(!!d.mongodb);
    } catch {
      setHealth(false);
    }
  };

  const analyze = async () => {
    if (!sql.trim()) return alert("Enter an SQL query.");
    setLoading(true);
    setCopied(false);
    try {
      const r = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "SQL Performance Analysis",
          sql: sql,
          userEmail: getDisplayName(currentUser),
        }),
      });

      const d = await r.json();
      if (d.ok) {
        setReport(d.report);

        try {
          const localKey = getStorageKey("advisor_reports");
          const raw = localStorage.getItem(localKey);
          const currentLocal = raw ? JSON.parse(raw) : [];
          const list = Array.isArray(currentLocal) ? currentLocal : [];
          const updated = [d.report, ...list.filter((item) => item._id !== d.report._id)];
          localStorage.setItem(localKey, JSON.stringify(updated));
        } catch (e) {}

        await loadReportsAndStats();
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
    }
  }, [currentUser]);

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
    let y = 18;

    const checkPageBreak = (neededHeight) => {
      if (y + neededHeight > 280) {
        doc.addPage();
        y = 18;
      }
    };

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("AI Query Performance Advisor - Optimization Report", margin, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toLocaleString()} | User: ${getDisplayName(currentUser)}`, margin, 18);

    y = 32;

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
        onLoginSuccess={(email) => {
          setCurrentUser(email);
          setShowAuth(false);
        }}
        onBackToWelcome={() => setShowAuth(false)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", minHeight: "100vh", background: "#0f172a" }}>
      {/* ---------------- SIDEBAR (Collapsible on mobile) ---------------- */}
      <aside
        style={{
          width: "100%",
          maxWidth: "260px",
          background: "#1e293b",
          borderRight: "1px solid #334155",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "20px 16px",
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
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Query Advisor</span>
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
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Signed in as</div>
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
              onClick={handleLogout}
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
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------- MAIN CONTENT ---------------- */}
      <div style={{ flex: "1 1 300px", overflowY: "auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {activeTab === "dashboard" ? (
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
          <main style={{ padding: "20px", maxWidth: "1200px", width: "100%", boxSizing: "border-box" }}>
            <section className="hero" style={{ marginBottom: "24px" }}>
              <div>
                <label>DATABASE PERFORMANCE WORKBENCH</label>
                <h1 style={{ fontSize: "28px" }}>
                  Analyze. Optimize.
                  <br />
                  <em>Perform Better.</em>
                </h1>
                <p style={{ color: "#94a3b8", fontSize: "14px" }}>
                  Analyze SQL queries, discover bottlenecks, generate AI-corrected queries,
                  and export DBA-ready optimization reports.
                </p>
              </div>

              <div className="heroStats" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
                <div
                  onClick={() => setSql(SAMPLE_EXPLAINABLE)}
                  style={{
                    cursor: "pointer",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#1e293b",
                  }}
                >
                  <Activity color="#38bdf8" size={16} />
                  <b style={{ marginLeft: "6px", fontSize: "12px" }}>Explainable AI</b>
                </div>

                <div
                  onClick={() => setSql(SAMPLE_DBA)}
                  style={{
                    cursor: "pointer",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#1e293b",
                  }}
                >
                  <ShieldCheck color="#10b981" size={16} />
                  <b style={{ marginLeft: "6px", fontSize: "12px" }}>DBA Ready</b>
                </div>

                <div
                  onClick={() => setSql(SAMPLE_MEDIUM)}
                  style={{
                    cursor: "pointer",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#1e293b",
                  }}
                >
                  <Gauge color="#f59e0b" size={16} />
                  <b style={{ marginLeft: "6px", fontSize: "12px" }}>Medium Risk</b>
                </div>
              </div>
            </section>

            <section className="layout" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              <div className="card editor" style={{ background: "#1e293b", padding: "16px", borderRadius: "8px", border: "1px solid #334155" }}>
                <div className="head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <h2 style={{ fontSize: "16px", margin: 0 }}>SQL Query</h2>
                  <button onClick={() => setSql(SAMPLE_DEFAULT)} style={{ background: "transparent", border: "1px solid #334155", color: "#94a3b8", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}>
                    Load Sample
                  </button>
                </div>
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  rows={8}
                  style={{ width: "100%", background: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: "6px", padding: "8px", boxSizing: "border-box", fontFamily: "monospace" }}
                />
                <div className="actions" style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                  <button
                    className="primary"
                    onClick={analyze}
                    disabled={loading}
                    style={{ background: "#2563eb", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
                  >
                    {loading ? "Analyzing..." : "Analyze Query →"}
                  </button>
                  <button onClick={() => setSql("")} style={{ background: "transparent", border: "1px solid #334155", color: "#94a3b8", padding: "8px 12px", borderRadius: "6px", cursor: "pointer" }}>
                    Clear
                  </button>
                </div>
              </div>

              <div className="card" style={{ background: "#1e293b", padding: "16px", borderRadius: "8px", border: "1px solid #334155" }}>
                <div className="head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h2 style={{ fontSize: "16px", margin: 0 }}>Performance Overview</h2>
                  {report && (
                    <span style={{ background: "#334155", padding: "4px 8px", borderRadius: "4px", fontSize: "12px" }}>
                      {report.analysis.riskLevel} Risk
                    </span>
                  )}
                </div>
                {report ? (
                  <>
                    <div style={{ display: "flex", gap: "14px", alignItems: "center", marginBottom: "14px" }}>
                      <div style={{ fontSize: "36px", fontWeight: "bold", color: "#38bdf8" }}>{report.analysis.performanceScore}</div>
                      <div>
                        <b>Performance Score / 100</b>
                        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>{report.analysis.executionEstimate}</p>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
                      <Metric n="Query Type" v={report.analysis.queryType} />
                      <Metric n="Joins" v={report.analysis.metrics.joins} />
                      <Metric n="Filters" v={report.analysis.metrics.filters} />
                      <Metric n="Functions" v={report.analysis.metrics.functions} />
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#64748b", padding: "20px 0", fontSize: "13px" }}>Run an analysis to see performance metrics.</div>
                )}
              </div>
            </section>

            {/* AI-CORRECTED QUERY */}
            {report?.analysis?.correctedQuery && (
              <section
                style={{
                  marginTop: "16px",
                  border: "1px solid #059669",
                  background: "#064e3b15",
                  padding: "16px",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Wand2 size={16} color="#34d399" />
                    <h3 style={{ color: "#34d399", margin: 0, fontSize: "15px" }}>AI-Recommended Corrected Query</h3>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => copyToClipboard(report.analysis.correctedQuery)}
                      style={{ background: "#1e293b", border: "1px solid #334155", color: "#f8fafc", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                    >
                      {copied ? "Copied!" : "Copy SQL"}
                    </button>
                    <button
                      onClick={() => setSql(report.analysis.correctedQuery)}
                      style={{ background: "#059669", border: "none", color: "#ffffff", padding: "4px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}
                    >
                      Apply
                    </button>
                  </div>
                </div>

                <pre
                  style={{
                    background: "#0f172a",
                    padding: "12px",
                    borderRadius: "6px",
                    color: "#38bdf8",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    overflowX: "auto",
                    margin: "12px 0 0 0",
                  }}
                >
                  {report.analysis.correctedQuery}
                </pre>
              </section>
            )}

            {report && (
              <div style={{ marginTop: "16px" }}>
                <button
                  onClick={download}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#2563eb", border: "none", color: "#fff", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
                >
                  <Download size={14} /> Export PDF Report
                </button>
              </div>
            )}
          </main>
        )}

        <footer style={{ marginTop: "auto", padding: "16px 20px", fontSize: "11px", color: "#64748b" }}>
          QueryPilot • Query Performance Advisor
        </footer>
      </div>
    </div>
  );
}

// ---------------- WELCOME SCREEN ---------------- //

function WelcomeScreen({ onGetStarted, onRegister }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0b1325", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#f8fafc", padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Zap size={22} color="#3b82f6" />
          <h1 style={{ fontSize: "18px", margin: 0 }}>QueryPilot</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onGetStarted} style={{ background: "transparent", border: "1px solid #334155", color: "#cbd5e1", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>
            Sign In
          </button>
          <button onClick={onRegister} style={{ background: "#2563eb", border: "none", color: "#fff", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
            Register
          </button>
        </div>
      </header>

      <main style={{ textAlign: "center", padding: "40px 0" }}>
        <h2 style={{ fontSize: "28px", margin: "0 0 12px 0" }}>Optimize Your Database Queries</h2>
        <p style={{ color: "#94a3b8", fontSize: "14px", maxWidth: "500px", margin: "0 auto 24px auto" }}>
          Diagnose bottlenecks, eliminate full table scans, and inspect AI-corrected SQL queries.
        </p>
        <button
          onClick={onGetStarted}
          style={{ background: "#2563eb", border: "none", color: "#fff", padding: "10px 24px", borderRadius: "6px", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
        >
          Launch Advisor →
        </button>
      </main>

      <footer style={{ textAlign: "center", fontSize: "12px", color: "#64748b" }}>
        QueryPilot • Full-Stack Performance Advisor
      </footer>
    </div>
  );
}

// ---------------- DASHBOARD VIEW ---------------- //

function DashboardView({ stats, reports, refreshing, onRefresh, onSelectQuery }) {
  const [searchTerm, setSearchTerm] = useState("");
  const lowRiskCount = reports.filter((r) => r.analysis?.riskLevel === "Low").length;
  const highRiskCount = stats.highRisk || reports.filter((r) => r.analysis?.riskLevel === "High").length;

  const filteredReports = reports.filter((r) =>
    (r.sql || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main style={{ padding: "20px", maxWidth: "1200px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px" }}>Health & Workload Dashboard</h1>
          <small style={{ color: "#94a3b8" }}>Aggregated insights from MongoDB</small>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "#1e293b", color: "#fff", border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <DashboardCard title="Total Queries" value={stats.total || reports.length} />
        <DashboardCard title="Avg Score" value={`${stats.averageScore || 0}/100`} />
        <DashboardCard title="High Risk Queries" value={highRiskCount} />
      </div>

      <div className="card" style={{ background: "#1e293b", padding: "16px", borderRadius: "8px", border: "1px solid #334155" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "15px" }}>Recent History</h3>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "4px", padding: "4px 8px", fontSize: "12px", color: "#fff" }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                <th style={{ padding: "8px" }}>SQL Snippet</th>
                <th style={{ padding: "8px" }}>Score</th>
                <th style={{ padding: "8px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "8px", fontFamily: "monospace", color: "#38bdf8", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.sql}
                  </td>
                  <td style={{ padding: "8px" }}>{r.analysis?.performanceScore || 0}</td>
                  <td style={{ padding: "8px" }}>
                    <button
                      onClick={() => onSelectQuery(r.sql)}
                      style={{ background: "#2563eb", border: "none", color: "#fff", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}
                    >
                      Load
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredReports.length && (
                <tr>
                  <td colSpan="3" style={{ padding: "16px", textAlign: "center", color: "#64748b" }}>
                    No reports found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function DashboardCard({ title, value }) {
  return (
    <div style={{ background: "#1e293b", padding: "14px", borderRadius: "8px", border: "1px solid #334155" }}>
      <div style={{ fontSize: "12px", color: "#94a3b8" }}>{title}</div>
      <div style={{ fontSize: "22px", fontWeight: "bold", color: "#f8fafc", marginTop: "4px" }}>{value}</div>
    </div>
  );
}

// ---------------- AUTHENTICATION SCREEN ---------------- //

function AuthScreen({ initialMode = "login", onLoginSuccess, onBackToWelcome }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const loginId = email.trim();
    if (!loginId || !password.trim()) {
      setError("Please fill all fields.");
      return;
    }

    try {
      localStorage.setItem("advisor_token", "demo-token");
      localStorage.setItem("advisor_user", loginId);
    } catch {}

    onLoginSuccess(loginId);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", padding: "20px" }}>
      <div style={{ background: "#1e293b", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "360px", border: "1px solid #334155", color: "#f8fafc" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={20} color="#3b82f6" />
            <h2 style={{ margin: 0, fontSize: "18px" }}>QueryPilot</h2>
          </div>
          <button onClick={onBackToWelcome} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: "12px", cursor: "pointer" }}>
            ← Back
          </button>
        </div>

        <h3 style={{ margin: "0 0 14px 0", fontSize: "15px" }}>Sign in to your account</h3>

        {error && (
          <div style={{ background: "#450a0a", color: "#f87171", padding: "8px", borderRadius: "4px", fontSize: "12px", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
              Username or Email
            </label>
            <input
              type="text"
              required
              placeholder="e.g. abc or user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "4px", background: "#0f172a", border: "1px solid #475569", color: "#fff", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "4px", background: "#0f172a", border: "1px solid #475569", color: "#fff", boxSizing: "border-box" }}
            />
          </div>

          <button
            type="submit"
            style={{ marginTop: "6px", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
          >
            Sign In →
          </button>
        </form>
      </div>
    </div>
  );
}

function Metric({ n, v }) {
  return (
    <div style={{ background: "#0f172a", padding: "8px", borderRadius: "4px" }}>
      <small style={{ color: "#64748b", display: "block" }}>{n}</small>
      <b style={{ color: "#f8fafc" }}>{v}</b>
    </div>
  );
}