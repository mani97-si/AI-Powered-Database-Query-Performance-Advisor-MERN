const path = require("path");
// Ensure .env is loaded whether run from server or root directory
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { analyzeSQL } = require("./services/analyzer");
const { reportDocument } = require("./models/Report");

const app = express();

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

/* =========================================================
   DATABASE / CONFIG
========================================================= */

let db = null;
let client = null;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "query_advisor_super_secret_jwt_key_2026_secure";

const PORT = Number(process.env.PORT || 5000);

// Admin accounts (Admin 1 and Admin 2)
const ADMIN_ACCOUNTS = [
  {
    id: "admin-1",
    email: String(process.env.ADMIN_EMAIL_1 || "admin@demo.edu").toLowerCase().trim(),
    password: String(process.env.ADMIN_PASSWORD_1 || "Admin@123").trim(),
  },
  {
    id: "admin-2",
    email: String(process.env.ADMIN_EMAIL_2 || "admin2@demo.edu").toLowerCase().trim(),
    password: String(process.env.ADMIN_PASSWORD_2 || "Admin@456").trim(),
  },
].filter((admin) => admin.email && admin.password);

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function createToken(user) {
  const secret = JWT_SECRET || "query_advisor_super_secret_jwt_key_2026_secure";
  return jwt.sign(
    {
      id: user.id || null,
      email: user.email,
      role: user.role,
      userName: user.userName || user.email.split("@")[0],
    },
    secret,
    {
      expiresIn: "7d",
    }
  );
}

function publicUser(user) {
  const email = user.email;
  return {
    id: user.id || user._id?.toString() || null,
    email,
    name: user.name || user.userName || user.username || email.split("@")[0],
    userName: user.userName || user.name || user.username || email.split("@")[0],
    role: user.role || "user",
  };
}

function matchesConfiguredPassword(candidate, configured) {
  if (!candidate || !configured) return false;
  const cand = String(candidate).trim();
  const conf = String(configured).trim();
  if (cand === conf) return true;
  try {
    const candidateHash = crypto.createHash("sha256").update(cand).digest();
    const configuredHash = crypto.createHash("sha256").update(conf).digest();
    return crypto.timingSafeEqual(candidateHash, configuredHash);
  } catch (e) {
    return cand === conf;
  }
}

function isConfiguredAdmin(email) {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  return ADMIN_ACCOUNTS.some(
    (admin) => admin.email === normalizedEmail
  );
}

function getAdminAccount(email) {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  return ADMIN_ACCOUNTS.find(
    (admin) => admin.email === normalizedEmail
  );
}

async function getOrCreateNormalUser(email, password, name) {
  const normalizedEmail = String(email).toLowerCase().trim();
  const resolvedName = String(name || normalizedEmail.split("@")[0]).trim();

  if (db) {
    try {
      let existing = await db.collection("users").findOne({ email: normalizedEmail });
      if (existing) {
        return publicUser(existing);
      }
      const hashedPassword = await bcrypt.hash(String(password || "defaultPass123"), 10);
      const result = await db.collection("users").insertOne({
        email: normalizedEmail,
        name: resolvedName,
        userName: resolvedName,
        password: hashedPassword,
        role: "user",
        createdAt: new Date(),
      });
      return {
        id: result.insertedId.toString(),
        email: normalizedEmail,
        name: resolvedName,
        userName: resolvedName,
        role: "user",
      };
    } catch (dbErr) {
      console.warn("DB user operation failed, using in-memory user fallback:", dbErr.message);
    }
  }

  return {
    id: "user-" + Date.now(),
    email: normalizedEmail,
    name: resolvedName,
    userName: resolvedName,
    role: "user",
  };
}

/* =========================================================
   AUTHENTICATION MIDDLEWARE
========================================================= */

function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required",
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Authentication token missing",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: "Invalid or expired authentication token",
    });
  }
}

function requireAdmin(req, res, next) {
  if (
    !req.user ||
    req.user.role !== "admin" ||
    !isConfiguredAdmin(req.user.email)
  ) {
    return res.status(403).json({
      ok: false,
      error: "Administrator access required",
    });
  }

  next();
}

function requireUser(req, res, next) {
  if (!req.user || req.user.role !== "user") {
    return res.status(403).json({
      ok: false,
      error: "User access required",
    });
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: "Authentication required",
    });
  }
  next();
}

/* =========================================================
   AUTHENTICATION ROUTES
========================================================= */

/*
  REGISTER NORMAL USER
*/
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, userName, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email and password are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const resolvedName = String(name || userName || normalizedEmail.split("@")[0]).trim();

    if (isConfiguredAdmin(normalizedEmail)) {
      return res.status(400).json({
        ok: false,
        error: "This email is reserved for an administrator account",
      });
    }

    const user = await getOrCreateNormalUser(normalizedEmail, password, resolvedName);
    const token = createToken(user);

    return res.status(201).json({
      ok: true,
      token,
      user,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  1. SEPARATE USER LOGIN
  User can log in with any email and password
*/
app.post("/api/auth/user/login", async (req, res) => {
  try {
    const { email, password, name, userName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email and password are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // If an administrator email is entered
    if (isConfiguredAdmin(normalizedEmail)) {
      const adminAccount = getAdminAccount(normalizedEmail);
      if (adminAccount && matchesConfiguredPassword(password, adminAccount.password)) {
        const adminUser = {
          id: adminAccount.id || `admin-${normalizedEmail}`,
          email: normalizedEmail,
          name: "Administrator",
          userName: normalizedEmail.split("@")[0],
          role: "admin",
        };
        const token = createToken(adminUser);
        return res.json({
          ok: true,
          token,
          user: adminUser,
        });
      } else {
        return res.status(401).json({
          ok: false,
          error: "Invalid administrator credentials",
        });
      }
    }

    // Normal User: can login with any email and password
    const resolvedName = String(name || userName || normalizedEmail.split("@")[0]).trim();
    const normalUser = await getOrCreateNormalUser(normalizedEmail, password, resolvedName);
    const token = createToken(normalUser);

    return res.json({
      ok: true,
      token,
      user: normalUser,
    });
  } catch (error) {
    console.error("User login error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  2. SEPARATE ADMIN LOGIN
  Authenticates configured administrator accounts (Admin 1 or Admin 2)
*/
app.post("/api/auth/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Administrator email and password are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const adminAccount = getAdminAccount(normalizedEmail);

    if (!adminAccount) {
      return res.status(401).json({
        ok: false,
        error: "Administrator account not recognized or access denied",
      });
    }

    const adminPasswordMatch = matchesConfiguredPassword(password, adminAccount.password);

    if (!adminPasswordMatch) {
      return res.status(401).json({
        ok: false,
        error: "Invalid administrator credentials",
      });
    }

    const adminUser = {
      id: adminAccount.id || `admin-${normalizedEmail}`,
      email: normalizedEmail,
      name: "Administrator",
      userName: normalizedEmail.split("@")[0],
      role: "admin",
    };

    const token = createToken(adminUser);

    return res.json({
      ok: true,
      token,
      user: adminUser,
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  3. GENERAL LOGIN
  Dispatches to Admin or User: Admin requires valid admin credentials; User can login with any email and password
*/
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, role, name, userName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email and password are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Check if logging in as Admin (either role is admin or email belongs to configured admin)
    if (role === "admin" || isConfiguredAdmin(normalizedEmail)) {
      const adminAccount = getAdminAccount(normalizedEmail);

      if (!adminAccount) {
        return res.status(401).json({
          ok: false,
          error: "Administrator account not recognized or access denied",
        });
      }

      const adminPasswordMatch = matchesConfiguredPassword(password, adminAccount.password);

      if (!adminPasswordMatch) {
        return res.status(401).json({
          ok: false,
          error: "Invalid administrator credentials",
        });
      }

      const adminUser = {
        id: adminAccount.id || `admin-${normalizedEmail}`,
        email: normalizedEmail,
        name: "Administrator",
        userName: normalizedEmail.split("@")[0],
        role: "admin",
      };

      const token = createToken(adminUser);

      return res.json({
        ok: true,
        token,
        user: adminUser,
      });
    }

    // Normal User Login: can login with ANY email and password
    const resolvedName = String(name || userName || normalizedEmail.split("@")[0]).trim();
    const normalUser = await getOrCreateNormalUser(normalizedEmail, password, resolvedName);
    const token = createToken(normalUser);

    return res.json({
      ok: true,
      token,
      user: normalUser,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  CURRENT USER
*/
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      if (!isConfiguredAdmin(req.user.email)) {
        return res.status(401).json({
          ok: false,
          error: "Administrator account is not configured",
        });
      }
      return res.json({
        ok: true,
        user: publicUser(req.user),
      });
    }

    if (!db) {
      return res.json({
        ok: true,
        user: publicUser(req.user),
      });
    }

    const user = await db.collection("users").findOne({
      email: req.user.email,
    });

    if (!user) {
      return res.json({
        ok: true,
        user: publicUser(req.user),
      });
    }

    return res.json({
      ok: true,
      user: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  RESET PASSWORD
*/
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database not connected",
      });
    }

    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: "Email and new password are required",
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        ok: false,
        error: "New password must contain at least 6 characters",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    if (isConfiguredAdmin(normalizedEmail)) {
      return res.status(400).json({
        ok: false,
        error: "Administrator passwords must be changed in server configuration",
      });
    }

    const user = await db.collection("users").findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "No account found with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.collection("users").updateOne(
      { email: normalizedEmail },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      }
    );

    return res.json({
      ok: true,
      message: "Password updated successfully! Please sign in.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mongodb: !!db,
    database: db ? db.databaseName : null,
    service: "AI Query Performance Advisor",
  });
});

/* =========================================================
   SQL ANALYSIS & REPORT GENERATION
   (Accessible by both User and Admin)
========================================================= */

app.post("/api/analyze", authenticateToken, requireAuth, async (req, res) => {
  try {
    const sql = String(req.body.sql || "").trim();

    if (!sql) {
      return res.status(400).json({
        ok: false,
        error: "SQL query is required",
      });
    }

    const userEmail = req.user.email;
    const userName = req.user.userName || req.user.email.split("@")[0];
    const role = req.user.role || "user";

    const analysis = analyzeSQL(sql);

    let userId = null;
    if (db) {
      const userDoc = await db.collection("users").findOne({ email: userEmail });
      if (userDoc) userId = userDoc._id;
    }

    const report = reportDocument({
      userId,
      query: sql,
      databaseType: req.body.databaseType || "MySQL",
      executionTime: req.body.executionTime || "1.2s",
      cost: analysis.performanceScore,
      recommendations: analysis.indexes || analysis.findings || [],
      title: req.body.title || "SQL Performance Analysis",
      sql,
      analysis,
      userEmail,
      userName,
    });

    report.role = role;

    if (db) {
      const insertResult = await db.collection("reports").insertOne(report);
      report._id = insertResult.insertedId;
    }

    return res.json({
      ok: true,
      report,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return res.status(400).json({
      ok: false,
      error: error.message,
    });
  }
});

/* =========================================================
   REPORTS (USER & ADMIN VIEW)
========================================================= */

app.get("/api/reports", authenticateToken, requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.json({
        ok: true,
        reports: [],
      });
    }

    let filter = {};

    // If Admin: can view all reports or filter by userEmail query parameter
    if (req.user.role === "admin") {
      if (req.query.userEmail) {
        filter.userEmail = String(req.query.userEmail).toLowerCase().trim();
      }
    } else {
      // Normal user: strictly scoped to own email
      filter.userEmail = req.user.email;
    }

    const reports = await db
      .collection("reports")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return res.json({
      ok: true,
      reports,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/* =========================================================
   SINGLE REPORT DETAILS & REPORT DELETION
========================================================= */

app.get("/api/reports/:id", authenticateToken, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "Invalid report ID" });
    }

    if (!db) {
      return res.status(503).json({ ok: false, error: "Database not connected" });
    }

    const report = await db.collection("reports").findOne({ _id: new ObjectId(id) });
    if (!report) {
      return res.status(404).json({ ok: false, error: "Report not found" });
    }

    if (req.user.role !== "admin" && report.userEmail !== req.user.email) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }

    return res.json({ ok: true, report });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete("/api/reports/:id", authenticateToken, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "Invalid report ID" });
    }

    if (!db) {
      return res.status(503).json({ ok: false, error: "Database not connected" });
    }

    const report = await db.collection("reports").findOne({ _id: new ObjectId(id) });
    if (!report) {
      return res.status(404).json({ ok: false, error: "Report not found" });
    }

    if (req.user.role !== "admin" && report.userEmail !== req.user.email) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }

    await db.collection("reports").deleteOne({ _id: new ObjectId(id) });
    return res.json({ ok: true, message: "Report deleted successfully" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/* =========================================================
   USER & WORKLOAD STATS
========================================================= */

app.get("/api/stats", authenticateToken, requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.json({
        ok: true,
        total: 0,
        averageScore: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
      });
    }

    let filter = {};
    if (req.user.role === "admin") {
      if (req.query.userEmail) {
        filter.userEmail = String(req.query.userEmail).toLowerCase().trim();
      }
      // If admin and no userEmail provided, stats cover entire workload
    } else {
      filter.userEmail = req.user.email;
    }

    const docs = await db
      .collection("reports")
      .find(filter, {
        projection: {
          "analysis.performanceScore": 1,
          "analysis.riskLevel": 1,
        },
      })
      .toArray();

    const total = docs.length;

    const averageScore = total
      ? Math.round(
          docs.reduce(
            (sum, doc) =>
              sum + Number(doc.analysis?.performanceScore || 0),
            0
          ) / total
        )
      : 0;

    const highRisk = docs.filter(
      (doc) => doc.analysis?.riskLevel === "High"
    ).length;

    const mediumRisk = docs.filter(
      (doc) => doc.analysis?.riskLevel === "Medium"
    ).length;

    const lowRisk = docs.filter(
      (doc) => doc.analysis?.riskLevel === "Low"
    ).length;

    return res.json({
      ok: true,
      total,
      averageScore,
      highRisk,
      mediumRisk,
      lowRisk,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/* =========================================================
   ADMIN PORTAL: VIEW ALL WHAT USERS HAVE DONE & STATS
========================================================= */

/*
  ADMIN: LIST ALL USERS WITH ACTIVITY SUMMARY
*/
app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!db) {
      return res.json({
        ok: true,
        users: [],
      });
    }

    const users = await db
      .collection("users")
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    // Aggregate user query activities
    const reports = await db
      .collection("reports")
      .find({}, {
        projection: {
          userEmail: 1,
          "analysis.performanceScore": 1,
          "analysis.riskLevel": 1,
          createdAt: 1,
        },
      })
      .toArray();

    const formattedUsers = users.map((user) => {
      const userReports = reports.filter(
        (r) => r.userEmail && r.userEmail.toLowerCase() === user.email.toLowerCase()
      );
      const totalQueries = userReports.length;
      const averageScore = totalQueries
        ? Math.round(
            userReports.reduce(
              (sum, r) => sum + Number(r.analysis?.performanceScore || 0),
              0
            ) / totalQueries
          )
        : 0;
      const highRiskQueries = userReports.filter(
        (r) => r.analysis?.riskLevel === "High"
      ).length;
      const lastActive = totalQueries
        ? userReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
        : user.createdAt;

      return {
        id: user._id.toString(),
        email: user.email,
        userName: user.userName || user.email.split("@")[0],
        role: "user",
        createdAt: user.createdAt,
        totalQueries,
        averageScore,
        highRiskQueries,
        lastActive,
      };
    });

    const adminUsers = ADMIN_ACCOUNTS.map((admin) => ({
      id: admin.id,
      email: admin.email,
      userName: admin.email.split("@")[0],
      role: "admin",
      createdAt: null,
      totalQueries: reports.filter((r) => r.userEmail === admin.email).length,
      averageScore: 100,
      highRiskQueries: 0,
      lastActive: new Date(),
    }));

    return res.json({
      ok: true,
      users: [...adminUsers, ...formattedUsers],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  ADMIN: VIEW ALL REPORTS SUBMITTED BY ALL USERS
*/
app.get("/api/admin/reports", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!db) {
      return res.json({
        ok: true,
        reports: [],
      });
    }

    const { email, risk, limit = 100 } = req.query;
    const filter = {};

    if (email) {
      filter.userEmail = String(email).toLowerCase().trim();
    }
    if (risk) {
      filter["analysis.riskLevel"] = risk;
    }

    const reports = await db
      .collection("reports")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .toArray();

    return res.json({
      ok: true,
      reports,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  ADMIN: VIEW SPECIFIC USER'S REPORTS
*/
app.get(
  "/api/admin/users/:email/reports",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      if (!db) {
        return res.json({
          ok: true,
          reports: [],
        });
      }

      const email = decodeURIComponent(req.params.email).toLowerCase().trim();

      const reports = await db
        .collection("reports")
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      return res.json({
        ok: true,
        reports,
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  }
);

/*
  ADMIN: VIEW SPECIFIC USER STATS
*/
app.get(
  "/api/admin/user-stats/:email",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      if (!db) {
        return res.json({
          ok: true,
          total: 0,
          averageScore: 0,
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0,
        });
      }

      const email = decodeURIComponent(req.params.email).toLowerCase().trim();

      const docs = await db
        .collection("reports")
        .find({ userEmail: email }, {
          projection: {
            "analysis.performanceScore": 1,
            "analysis.riskLevel": 1,
          },
        })
        .toArray();

      const total = docs.length;

      const averageScore = total
        ? Math.round(
            docs.reduce(
              (sum, doc) =>
                sum + Number(doc.analysis?.performanceScore || 0),
              0
            ) / total
          )
        : 0;

      const highRisk = docs.filter(
        (doc) => doc.analysis?.riskLevel === "High"
      ).length;

      const mediumRisk = docs.filter(
        (doc) => doc.analysis?.riskLevel === "Medium"
      ).length;

      const lowRisk = docs.filter(
        (doc) => doc.analysis?.riskLevel === "Low"
      ).length;

      return res.json({
        ok: true,
        email,
        total,
        averageScore,
        highRisk,
        mediumRisk,
        lowRisk,
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  }
);

/*
  ADMIN: OVERALL WORKLOAD STATS
*/
app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!db) {
      return res.json({
        ok: true,
        totalUsers: 0,
        totalReports: 0,
        averageScore: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
      });
    }

    const totalUsers = await db.collection("users").countDocuments();

    const reports = await db
      .collection("reports")
      .find({}, {
        projection: {
          "analysis.performanceScore": 1,
          "analysis.riskLevel": 1,
        },
      })
      .toArray();

    const totalReports = reports.length;

    const averageScore = totalReports
      ? Math.round(
          reports.reduce(
            (sum, doc) =>
              sum + Number(doc.analysis?.performanceScore || 0),
            0
          ) / totalReports
        )
      : 0;

    const highRisk = reports.filter(
      (doc) => doc.analysis?.riskLevel === "High"
    ).length;

    const mediumRisk = reports.filter(
      (doc) => doc.analysis?.riskLevel === "Medium"
    ).length;

    const lowRisk = reports.filter(
      (doc) => doc.analysis?.riskLevel === "Low"
    ).length;

    return res.json({
      ok: true,
      totalUsers,
      totalReports,
      averageScore,
      highRisk,
      mediumRisk,
      lowRisk,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  ADMIN: COMPREHENSIVE ACTIVITY FEED
  Lists recent actions and queries across all users
*/
app.get("/api/admin/activity", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!db) {
      return res.json({ ok: true, activity: [] });
    }

    const recentReports = await db
      .collection("reports")
      .find({})
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    const activity = recentReports.map((r) => ({
      id: r._id,
      userEmail: r.userEmail,
      userName: r.userName || r.userEmail?.split("@")[0] || "User",
      action: "Executed Query Analysis",
      sql: r.sql,
      score: r.analysis?.performanceScore || 0,
      riskLevel: r.analysis?.riskLevel || "Low",
      createdAt: r.createdAt,
    }));

    return res.json({ ok: true, activity });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/*
  ADMIN: GENERATE SYSTEM-WIDE PERFORMANCE & AUDIT REPORT
  Compiles and persists an administrative executive summary of user query workloads
*/
app.post("/api/admin/generate-report", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database not connected" });
    }

    const [users, reports] = await Promise.all([
      db.collection("users").find({}, { projection: { password: 0 } }).toArray(),
      db.collection("reports").find({}).sort({ createdAt: -1 }).toArray(),
    ]);

    const totalReports = reports.length;
    const totalUsers = users.length;

    const avgScore = totalReports
      ? Math.round(
          reports.reduce((sum, r) => sum + Number(r.analysis?.performanceScore || 0), 0) / totalReports
        )
      : 0;

    const highRiskReports = reports.filter((r) => r.analysis?.riskLevel === "High");
    const mediumRiskReports = reports.filter((r) => r.analysis?.riskLevel === "Medium");
    const lowRiskReports = reports.filter((r) => r.analysis?.riskLevel === "Low");

    // Extract top frequent bottlenecks across all users
    const bottleneckCounts = {};
    reports.forEach((r) => {
      (r.analysis?.findings || []).forEach((f) => {
        bottleneckCounts[f.title] = (bottleneckCounts[f.title] || 0) + 1;
      });
    });

    const topBottlenecks = Object.entries(bottleneckCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, count }));

    // User workload ranking
    const userBreakdown = users.map((u) => {
      const uReports = reports.filter(
        (r) => r.userEmail && r.userEmail.toLowerCase() === u.email.toLowerCase()
      );
      return {
        email: u.email,
        queriesSubmitted: uReports.length,
        avgScore: uReports.length
          ? Math.round(
              uReports.reduce((s, r) => s + Number(r.analysis?.performanceScore || 0), 0) / uReports.length
            )
          : 0,
        highRiskCount: uReports.filter((r) => r.analysis?.riskLevel === "High").length,
      };
    });

    const auditReport = {
      title: req.body.title || "Enterprise Query Performance & System Audit Report",
      generatedBy: req.user.email,
      generatedAt: new Date(),
      metrics: {
        totalUsers,
        totalQueriesAnalyzed: totalReports,
        averageSystemScore: avgScore,
        riskDistribution: {
          high: highRiskReports.length,
          medium: mediumRiskReports.length,
          low: lowRiskReports.length,
        },
      },
      topBottlenecks,
      userBreakdown,
      recommendations: [
        "Create covering composite indexes on tables targeted by high-frequency user WHERE clauses.",
        "Educate development teams on replacing SELECT * with explicit column projections.",
        "Wrap case-insensitive string predicates with indexed functional columns or collations to avoid non-sargable scans.",
        "Add pagination limits to high-risk sorting queries.",
      ],
    };

    const result = await db.collection("admin_reports").insertOne(auditReport);
    auditReport._id = result.insertedId;

    return res.json({
      ok: true,
      report: auditReport,
    });
  } catch (error) {
    console.error("Admin generate report error:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/*
  ADMIN: GET PREVIOUSLY GENERATED AUDIT REPORTS
*/
app.get("/api/admin/generated-reports", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!db) {
      return res.json({ ok: true, reports: [] });
    }

    const reports = await db
      .collection("admin_reports")
      .find({})
      .sort({ generatedAt: -1 })
      .limit(50)
      .toArray();

    return res.json({ ok: true, reports });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "AI Query Performance Advisor API",
  });
});

/* =========================================================
   START SERVER
========================================================= */

async function start() {
  const server = app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
    console.log(`Configured administrator accounts: ${ADMIN_ACCOUNTS.length}`);
  });

  try {
    const rawUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017";

    const clientOptions = {
      serverSelectionTimeoutMS: 8000,
      tlsAllowInvalidCertificates: true,
    };

    client = new MongoClient(rawUri, clientOptions);
    await client.connect();

    const targetDbName =
      process.env.MONGODB_DB || "query_performance_advisors";

    db = client.db(targetDbName);

    // Ensure Indexes
    await Promise.all([
      db.collection("reports").createIndex({ createdAt: -1 }),
      db.collection("reports").createIndex({ userEmail: 1, createdAt: -1 }),
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
    ]);

    console.log("MongoDB connected successfully to DB:", db.databaseName);
  } catch (error) {
    console.warn("MongoDB Connection Notice:", error.message);
    console.log("Server operating in resilient hybrid mode (JWT & auth active).");
  }

  const shutdown = async () => {
    console.log("\nGracefully shutting down...");
    server.close(async () => {
      if (client) await client.close();
      console.log("MongoDB connection closed. Server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();