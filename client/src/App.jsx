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
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem("advisor_user") || null
  );
  const [showAuth, setShowAuth] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState("login");
  const [activeTab, setActiveTab] = useState("workbench"); // "workbench" | "dashboard"
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
    return `${prefix}_${user.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
  };

  const handleLogout = () => {
    localStorage.removeItem("advisor_token");
    localStorage.removeItem("advisor_user");
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

    // Load local cache immediately so history is per-user even offline
    const localReports = JSON.parse(localStorage.getItem(localReportsKey) || "[]");
    const localStats = JSON.parse(
      localStorage.getItem(localStatsKey) ||
        JSON.stringify({ total: 0, averageScore: 0, highRisk: 0 })
    );

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

      if (dataReports.ok && Array.isArray(dataReports.reports)) {
        // Merge without cross-pollinating
        setReports(dataReports.reports);
        localStorage.setItem(localReportsKey, JSON.stringify(dataReports.reports));
      }
      if (dataStats.ok) {
        setStats(dataStats);
        localStorage.setItem(localStatsKey, JSON.stringify(dataStats));
      }
    } catch (err) {
      console.warn("Backend scoped sync skipped; using local per-user history.");
    } finally {
      setRefreshing(false);
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

        // Save into isolated per-user local cache
        const localKey = getStorageKey("advisor_reports");
        const currentLocal = JSON.parse(localStorage.getItem(localKey) || "[]");
        const updated = [d.report, ...currentLocal.filter((item) => item._id !== d.report._id)];
        localStorage.setItem(localKey, JSON.stringify(updated));

        await loadReportsAndStats();
      } else {
        alert(`Analysis error: ${d.error}`);
      }
    } catch (e) {
      console.error("Analysis request failed:", e);
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
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                transition: "all 0.15s ease",
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
                transition: "all 0.15s ease",
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

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
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

              {/* Quick Test Sample Queries */}
              <div className="heroStats" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <div
                  onClick={() => setSql(SAMPLE_EXPLAINABLE)}
                  style={{
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    border: "1px solid #334155",
                    userSelect: "none",
                  }}
                  title="Click to load Explainable AI sample query"
                >
                  <Activity color="#38bdf8" />
                  <b>Explainable AI</b>
                  <small>Rule-based analysis (Click to test)</small>
                </div>

                <div
                  onClick={() => setSql(SAMPLE_DBA)}
                  style={{
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    border: "1px solid #334155",
                    userSelect: "none",
                  }}
                  title="Click to load DBA index sample query"
                >
                  <ShieldCheck color="#10b981" />
                  <b>DBA Ready</b>
                  <small>Index recommendations (Click to test)</small>
                </div>

                <div
                  onClick={() => setSql(SAMPLE_MEDIUM)}
                  style={{
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    border: "1px solid #334155",
                    userSelect: "none",
                  }}
                  title="Click to load Aggregation / Medium Risk query"
                >
                  <Gauge color="#f59e0b" />
                  <b>Medium Risk</b>
                  <small>Aggregation buffer (Click to test)</small>
                </div>

                <div
                  onClick={() => setSql(SAMPLE_SUBQUERY)}
                  style={{
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    border: "1px solid #334155",
                    userSelect: "none",
                  }}
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
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  rows={8}
                />
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

            {/* AI-CORRECTED QUERY DISPLAY CARD */}
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
                      <small>Optimized to avoid full-table scans, non-sargable predicates, and I/O bloat</small>
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

                {report.analysis.rewritesApplied?.length > 0 && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#94a3b8" }}>
                    <b>Optimizations applied:</b>
                    <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                      {report.analysis.rewritesApplied.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
                      {new Date(r.createdAt).toLocaleString()} • Score{" "}
                      {r.analysis?.performanceScore || 0}/100
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
              boxShadow: "0 0 16px rgba(37, 99, 235, 0.4)",
            }}
          >
            <Zap size={22} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: "bold", margin: 0, letterSpacing: "-0.3px" }}>
              QueryPilot
            </h1>
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
              fontWeight: "500",
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
              boxShadow: "0 0 14px rgba(37, 99, 235, 0.35)",
            }}
          >
            Get Started Free
          </button>
        </div>
      </header>

      <main style={{ maxWidth: "1080px", margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#1e293b",
            border: "1px solid #334155",
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "12px",
            color: "#38bdf8",
            marginBottom: "24px",
          }}
        >
          <Wand2 size={14} color="#38bdf8" />
          <span>Intelligent Full-Stack Query Optimizer & Health Monitor</span>
        </div>

        <h1
          style={{
            fontSize: "44px",
            fontWeight: 800,
            lineHeight: 1.2,
            margin: "0 0 18px 0",
            letterSpacing: "-0.8px",
          }}
        >
          Welcome to <span style={{ color: "#38bdf8" }}>Query Advisor</span>
        </h1>
        <p
          style={{
            fontSize: "16px",
            color: "#94a3b8",
            maxWidth: "680px",
            margin: "0 auto 36px auto",
            lineHeight: 1.6,
          }}
        >
          Diagnose database bottlenecks, eliminate full table scans, generate DBA-ready composite
          indexes, and inspect AI-corrected SQL queries with verified risk calculations.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginBottom: "64px" }}>
          <button
            onClick={onGetStarted}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#2563eb",
              border: "none",
              color: "#ffffff",
              padding: "12px 28px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 4px 18px rgba(37, 99, 235, 0.4)",
            }}
          >
            Launch Advisor <ChevronRight size={16} />
          </button>
          <button
            onClick={onRegister}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#cbd5e1",
              padding: "12px 24px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Create an Account
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", textAlign: "left" }}>
          <div style={{ background: "#111a2e", border: "1px solid #1e293b", borderRadius: "12px", padding: "24px" }}>
            <div style={{ width: "36px", height: "36px", background: "#064e3b", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
              <ShieldCheck size={20} color="#34d399" />
            </div>
            <h3 style={{ fontSize: "16px", margin: "0 0 6px 0", color: "#f8fafc" }}>Rule-Based Static Analysis</h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
              Detect non-sargable wildcards, missing joins, and unindexed column predicates before they hit production.
            </p>
          </div>

          <div style={{ background: "#111a2e", border: "1px solid #1e293b", borderRadius: "12px", padding: "24px" }}>
            <div style={{ width: "36px", height: "36px", background: "#1e3a5f", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
              <Database size={20} color="#38bdf8" />
            </div>
            <h3 style={{ fontSize: "16px", margin: "0 0 6px 0", color: "#f8fafc" }}>DBA Index Recommendations</h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
              Receive instant index syntax for foreign keys and filtering columns to drop buffer I/O and query latency.
            </p>
          </div>

          <div style={{ background: "#111a2e", border: "1px solid #1e293b", borderRadius: "12px", padding: "24px" }}>
            <div style={{ width: "36px", height: "36px", background: "#3b1e3f", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
              <BarChart3 size={20} color="#c084fc" />
            </div>
            <h3 style={{ fontSize: "16px", margin: "0 0 6px 0", color: "#f8fafc" }}>Workload Health Dashboard</h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
              Log session audit queries into MongoDB, visualize workload risk distribution, and export DBA PDF reports.
            </p>
          </div>
        </div>
      </main>

      <footer style={{ borderTop: "1px solid #1e293b", padding: "20px 48px", textAlign: "center", fontSize: "12px", color: "#64748b" }}>
        QueryPilot • AI-Powered Database Query Performance Advisor
      </footer>
    </div>
  );
}

// ---------------- DASHBOARD VIEW ---------------- //

function DashboardView({ stats, reports, refreshing, onRefresh, onSelectQuery }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");

  const lowRiskCount = reports.filter((r) => r.analysis?.riskLevel === "Low").length;
  const mediumRiskCount = reports.filter((r) => r.analysis?.riskLevel === "Medium").length;
  const highRiskCount = stats.highRisk || reports.filter((r) => r.analysis?.riskLevel === "High").length;

  const filteredReports = reports.filter((r) => {
    const matchesSearch = (r.sql || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk =
      riskFilter === "ALL" || r.analysis?.riskLevel?.toUpperCase() === riskFilter;
    return matchesSearch && matchesRisk;
  });

  const estimatedSavings = Math.min(
    95,
    Math.max(10, Math.round(highRiskCount * 24 + mediumRiskCount * 12))
  );

  const downloadReportPDF = (r) => {
    const a = r.analysis;
    if (!a) return alert("Analysis details unavailable for this report.");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("AI Query Performance Advisor - Optimization Report", margin, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date(r.createdAt).toLocaleString()} | Title: ${r.title || "SQL Analysis"}`, margin, 18);

    y = 32;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Score: ${a.performanceScore || 0}/100`, margin + 5, y + 8);
    doc.text(`Risk: ${a.riskLevel || "Low"}`, margin + 55, y + 8);
    doc.text(`Query Type: ${a.queryType || "SELECT"}`, margin + 110, y + 8);

    y += 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("SQL Query:", margin, y);
    y += 5;

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(14, 116, 144);
    const sqlLines = doc.splitTextToSize(r.sql || "", contentWidth);
    doc.text(sqlLines, margin, y);

    doc.save(`report-${r._id || Date.now()}.pdf`);
  };

  return (
    <main style={{ padding: "28px 36px", maxWidth: "1200px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "22px" }}>Advisor Health & Workload Dashboard</h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
            Aggregated diagnostic insights and workload analysis from MongoDB
          </p>
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
        <DashboardCard
          title="Total Queries Analyzed"
          value={stats.total || reports.length}
          icon={<Layers color="#38bdf8" size={24} />}
          detail="Stored across your workload sessions"
        />
        <DashboardCard
          title="Avg Performance Score"
          value={`${stats.averageScore || 0} / 100`}
          icon={<Gauge color="#10b981" size={24} />}
          detail="Computed across your queries"
        />
        <DashboardCard
          title="Critical Bottlenecks"
          value={highRiskCount}
          icon={<ShieldAlert color="#ef4444" size={24} />}
          detail="Queries marked High Risk"
        />
        <DashboardCard
          title="Est. Disk I/O Savings"
          value={`~${estimatedSavings}%`}
          icon={<TrendingDown color="#34d399" size={24} />}
          detail="Projected reduction after indexing"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", marginBottom: "24px" }}>
        <div className="card" style={{ padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px" }}>Risk Distribution</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <RiskProgressBar label="Low Risk" count={lowRiskCount} total={reports.length} color="#10b981" />
            <RiskProgressBar label="Medium Risk" count={mediumRiskCount} total={reports.length} color="#f59e0b" />
            <RiskProgressBar label="High Risk" count={highRiskCount} total={reports.length} color="#ef4444" />
          </div>

          <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid #334155" }}>
            <small style={{ color: "#64748b", textTransform: "uppercase", fontWeight: "600" }}>System Advisor Summary</small>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#cbd5e1", lineHeight: "1.4" }}>
              {highRiskCount > 0
                ? `${highRiskCount} query workloads require covering indexes to prevent disk spills.`
                : "Your analyzed queries currently adhere to standard index patterns."}
            </p>
          </div>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "16px" }}>Analyzed Workload History</h3>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} color="#64748b" style={{ position: "absolute", left: "8px", top: "8px" }} />
                <input
                  type="text"
                  placeholder="Search queries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "4px",
                    padding: "6px 8px 6px 28px",
                    fontSize: "12px",
                    color: "#f8fafc",
                    width: "130px",
                    outline: "none",
                  }}
                />
              </div>

              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                  padding: "6px 8px",
                  fontSize: "12px",
                  color: "#94a3b8",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="ALL">All Risks</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                  <th style={{ padding: "8px 10px" }}>SQL Snippet</th>
                  <th style={{ padding: "8px 10px" }}>Score</th>
                  <th style={{ padding: "8px 10px" }}>Risk</th>
                  <th style={{ padding: "8px 10px" }}>Timestamp</th>
                  <th style={{ padding: "8px 10px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.slice(0, 7).map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "10px", fontFamily: "monospace", color: "#38bdf8", maxWidth: "230px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.sql}
                    </td>
                    <td style={{ padding: "10px", fontWeight: "bold" }}>
                      {r.analysis?.performanceScore || 0}
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span className={"pill " + (r.analysis?.riskLevel?.toLowerCase() || "low")}>
                        {r.analysis?.riskLevel || "Low"}
                      </span>
                    </td>
                    <td style={{ padding: "10px", color: "#64748b" }}>
                      {new Date(r.createdAt).toLocaleDateString()}
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
                        Load Query
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredReports.length && (
                  <tr>
                    <td colSpan="5" style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                      No matching query workloads found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---------------- RECENT REPORTS SECTION (BELOW DASHBOARD) ---------------- */}
      <section className="card history" style={{ padding: "20px" }}>
        <div className="head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "16px", margin: "0 0 4px 0" }}>Recent Reports</h2>
            <small style={{ color: "#64748b" }}>Scoped to {getDisplayName(currentUser)}</small>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: "#1e293b",
              color: "#ffffff",
              border: "1px solid #334155",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />{" "}
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {reports.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {reports.map((r, i) => (
              <div
                key={i}
                className="historyRow"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                }}
              >
                <div>
                  <b style={{ color: "#f8fafc", fontSize: "13px", display: "block" }}>{r.title || "SQL Performance Audit"}</b>
                  <span style={{ color: "#64748b", fontSize: "11px" }}>
                    {new Date(r.createdAt).toLocaleString()} • Score {r.analysis?.performanceScore || 0}/100 • Risk: {r.analysis?.riskLevel || "Low"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => onSelectQuery(r.sql)}
                    style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      color: "#38bdf8",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    Load in Workbench
                  </button>
                  <button
                    onClick={() => downloadReportPDF(r)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "#2563eb",
                      border: "none",
                      color: "#ffffff",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    <Download size={13} /> PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
            No saved reports found for your account.
          </div>
        )}
      </section>
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

function RiskProgressBar({ label, count, total, color }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
        <span>{label}</span>
        <span>{count} ({percentage}%)</span>
      </div>
      <div style={{ width: "100%", height: "8px", background: "#0f172a", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ width: `${percentage}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

// ---------------- AUTHENTICATION SCREEN ---------------- //

function AuthScreen({ initialMode = "login", onLoginSuccess, onBackToWelcome }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetState = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
    setPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    const loginId = email.trim();

    // DEMO LOGIN BYPASS: Accepts any non-empty username/email & password
    if (mode === "login") {
      if (!loginId || !password.trim()) {
        setError("Enter a login ID/email and password.");
        setSubmitting(false);
        return;
      }

      localStorage.setItem("advisor_token", "demo-token");
      localStorage.setItem("advisor_user", loginId);
      onLoginSuccess(loginId);
      setSubmitting(false);
      return;
    }

    let endpoint = "/auth/register";
    let payload = { email: loginId, password };

    if (mode === "forgot") {
      endpoint = "/auth/reset-password";
      payload = { email: loginId, newPassword: password };
    }

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok) {
        if (mode === "forgot") {
          setSuccess(data.message || "Password updated successfully! Please sign in.");
          setMode("login");
          setPassword("");
        } else {
          localStorage.setItem("advisor_token", data.token);
          localStorage.setItem("advisor_user", data.email);
          onLoginSuccess(data.email);
        }
      } else {
        setError(data.error || "Operation failed");
      }
    } catch (err) {
      setError("Cannot reach backend server. Ensure backend is active.");
    } finally {
      setSubmitting(false);
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
          maxWidth: "400px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          border: "1px solid #334155",
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "#3b82f6",
                padding: "8px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={22} color="#ffffff" />
            </div>
            <h2 style={{ margin: 0, fontSize: "20px" }}>QueryPilot</h2>
          </div>

          <button
            onClick={onBackToWelcome}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              fontSize: "12px",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ← Back
          </button>
        </div>

        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "#cbd5e1" }}>
          {mode === "login" && "Sign in to your account (Demo Mode)"}
          {mode === "register" && "Create a new account"}
          {mode === "forgot" && "Reset your password"}
        </h3>
        <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#94a3b8" }}>
          {mode === "forgot"
            ? "Enter your account email and choose a new password"
            : "Access the query performance workbench"}
        </p>

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

        {success && (
          <div
            style={{
              background: "#052e16",
              color: "#4ade80",
              border: "1px solid #14532d",
              borderRadius: "6px",
              padding: "10px 12px",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
              Username or Email
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={16} color="#64748b" style={{ position: "absolute", left: "12px", top: "12px" }} />
              <input
                type="text"
                required
                placeholder={mode === "login" ? "e.g. abc or user@example.com" : "name@company.com"}
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
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <label style={{ fontSize: "12px", color: "#94a3b8" }}>
                {mode === "forgot" ? "New Password" : "Password"}
              </label>
              {mode === "login" && (
                <span
                  onClick={() => resetState("forgot")}
                  style={{ fontSize: "12px", color: "#60a5fa", cursor: "pointer" }}
                >
                  Forgot password?
                </span>
              )}
            </div>
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
                  boxSizing: "border-box",
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
              gap: "8px",
            }}
          >
            {submitting
              ? "Processing..."
              : mode === "login"
              ? "Sign In"
              : mode === "register"
              ? "Register Account"
              : "Reset Password"}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
          {mode === "login" && (
            <>
              Don't have an account?{" "}
              <span
                onClick={() => resetState("register")}
                style={{ color: "#60a5fa", cursor: "pointer", fontWeight: "600" }}
              >
                Sign up
              </span>
            </>
          )}

          {mode === "register" && (
            <>
              Already have an account?{" "}
              <span
                onClick={() => resetState("login")}
                style={{ color: "#60a5fa", cursor: "pointer", fontWeight: "600" }}
              >
                Sign in
              </span>
            </>
          )}

          {mode === "forgot" && (
            <>
              Remembered your credentials?{" "}
              <span
                onClick={() => resetState("login")}
                style={{ color: "#60a5fa", cursor: "pointer", fontWeight: "600" }}
              >
                Back to Sign in
              </span>
            </>
          )}
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