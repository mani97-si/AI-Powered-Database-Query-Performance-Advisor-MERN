require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { analyzeSQL } = require("./services/analyzer");
const { reportDocument } = require("./models/Report");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

let db = null;
const JWT_SECRET = process.env.JWT_SECRET || "query_advisor_super_secret_jwt_key_2026_secure";

// ---------------- AUTHENTICATION ENDPOINTS ---------------- //

app.post("/api/auth/register", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database not connected" });

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.collection("users").findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ ok: false, error: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.collection("users").insertOne({
      email: normalizedEmail,
      password: hashedPassword,
      createdAt: new Date(),
    });

    const token = jwt.sign(
      { id: result.insertedId, email: normalizedEmail },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ ok: true, token, email: normalizedEmail });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database not connected" });

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.collection("users").findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ ok: false, error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ ok: false, error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ ok: true, token, email: user.email });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database not connected" });

    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ ok: false, error: "Email and new password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.collection("users").findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ ok: false, error: "No account found with this email" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.collection("users").updateOne(
      { email: normalizedEmail },
      { $set: { password: hashedPassword, updatedAt: new Date() } }
    );

    res.json({ ok: true, message: "Password updated successfully! Please sign in." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------- ADVISOR ENDPOINTS ---------------- //

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mongodb: !!db,
    database: db ? db.databaseName : null,
    service: "AI Query Performance Advisor",
  });
});

// Save Analysis (Strictly saves normalized userEmail)
app.post("/api/analyze", async (req, res) => {
  try {
    const sql = String(req.body.sql || "");
    const userEmail = req.body.userEmail ? req.body.userEmail.toLowerCase().trim() : "anonymous";
    const analysis = analyzeSQL(sql);
    
    const report = reportDocument({ 
      title: req.body.title || "SQL Performance Analysis", 
      sql, 
      analysis,
      userEmail 
    });

    if (db) {
      await db.collection("reports").insertOne(report);
    }

    res.json({ ok: true, report });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Fetch Reports (Strictly filtered by the requesting userEmail)
app.get("/api/reports", async (req, res) => {
  try {
    if (!db) return res.json({ ok: true, reports: [] });
    const userEmail = req.query.userEmail ? req.query.userEmail.toLowerCase().trim() : null;

    if (!userEmail) {
      return res.json({ ok: true, reports: [] });
    }

    const reports = await db
      .collection("reports")
      .find({ userEmail })
      .sort({ createdAt: -1 })
      .limit(25)
      .toArray();
      
    res.json({ ok: true, reports });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Fetch Dashboard KPI Stats (Strictly filtered by the requesting userEmail)
app.get("/api/stats", async (req, res) => {
  try {
    if (!db) return res.json({ ok: true, total: 0, averageScore: 0, highRisk: 0 });
    const userEmail = req.query.userEmail ? req.query.userEmail.toLowerCase().trim() : null;

    if (!userEmail) {
      return res.json({ ok: true, total: 0, averageScore: 0, highRisk: 0 });
    }

    const docs = await db
      .collection("reports")
      .find({ userEmail }, { projection: { "analysis.performanceScore": 1, "analysis.riskLevel": 1 } })
      .toArray();

    const total = docs.length;
    const averageScore = total
      ? Math.round(docs.reduce((s, d) => s + (d.analysis?.performanceScore || 0), 0) / total)
      : 0;
    const highRisk = docs.filter((d) => d.analysis?.riskLevel === "High").length;

    res.json({ ok: true, total, averageScore, highRisk });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = Number(process.env.PORT || 5000);

async function start() {
  try {
    const rawUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
    const client = new MongoClient(rawUri);
    await client.connect();

    const targetDbName = process.env.MONGODB_DB || "query_performance_advisors";
    db = client.db(targetDbName);

    await db.collection("reports").createIndex({ createdAt: -1 });
    await db.collection("reports").createIndex({ userEmail: 1, createdAt: -1 });
    await db.collection("users").createIndex({ email: 1 }, { unique: true });

    console.log("MongoDB connected successfully to DB:", db.databaseName);
  } catch (e) {
    console.error("MongoDB Connection Failed:", e.message);
  }
  app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
}

start();