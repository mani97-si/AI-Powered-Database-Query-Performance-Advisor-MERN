require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
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

const PORT = Number(process.env.PORT || 5000);

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "query_advisor_super_secret_jwt_key_2026_secure";

/*
|--------------------------------------------------------------------------
| ADMIN ACCOUNTS
|--------------------------------------------------------------------------
| These are the ONLY two admin accounts.
|
| Change these values to your required admin emails/passwords.
| For better security, put them in your .env file.
|--------------------------------------------------------------------------
*/

const ADMIN_ACCOUNTS = [
  {
    email: (
      process.env.ADMIN1_EMAIL || "admin1@queryadvisor.com"
    ).toLowerCase(),
    password: process.env.ADMIN1_PASSWORD || "Admin@123",
  },
  {
    email: (
      process.env.ADMIN2_EMAIL || "admin2@queryadvisor.com"
    ).toLowerCase(),
    password: process.env.ADMIN2_PASSWORD || "Admin@456",
  },
];

/*
|--------------------------------------------------------------------------
| HELPER FUNCTIONS
|--------------------------------------------------------------------------
*/

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function isAdminEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  return ADMIN_ACCOUNTS.some(
    (admin) => admin.email === normalizedEmail
  );
}

/*
|--------------------------------------------------------------------------
| JWT AUTHENTICATION MIDDLEWARE
|--------------------------------------------------------------------------
*/

function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

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

/*
|--------------------------------------------------------------------------
| ADMIN ONLY MIDDLEWARE
|--------------------------------------------------------------------------
*/

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      ok: false,
      error: "Admin access required",
    });
  }

  next();
}

/*
|--------------------------------------------------------------------------
| DATABASE CHECK
|--------------------------------------------------------------------------
*/

function requireDatabase(req, res, next) {
  if (!db) {
    return res.status(503).json({
      ok: false,
      error: "Database not connected",
    });
  }

  next();
}

/*
|--------------------------------------------------------------------------
| AUTH - REGISTER USER
|--------------------------------------------------------------------------
*/

app.post(
  "/api/auth/register",
  requireDatabase,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          ok: false,
          error: "Email and password are required",
        });
      }

      const normalizedEmail = normalizeEmail(email);

      if (!normalizedEmail.includes("@")) {
        return res.status(400).json({
          ok: false,
          error: "Please enter a valid email address",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          ok: false,
          error: "Password must contain at least 6 characters",
        });
      }

      /*
      |--------------------------------------------------------------
      | ADMIN EMAILS CANNOT REGISTER AS NORMAL USERS
      |--------------------------------------------------------------
      */

      if (isAdminEmail(normalizedEmail)) {
        return res.status(403).json({
          ok: false,
          error:
            "This email is reserved for administrator login",
        });
      }

      const existingUser = await db.collection("users").findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        return res.status(400).json({
          ok: false,
          error:
            "An account with this email already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await db.collection("users").insertOne({
        email: normalizedEmail,
        password: hashedPassword,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const token = jwt.sign(
        {
          id: result.insertedId.toString(),
          email: normalizedEmail,
          role: "user",
        },
        JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

      return res.json({
        ok: true,
        token,
        user: {
          id: result.insertedId,
          email: normalizedEmail,
          role: "user",
        },
      });
    } catch (error) {
      console.error("Register error:", error);

      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| AUTH - USER LOGIN
|--------------------------------------------------------------------------
*/

app.post(
  "/api/auth/login",
  requireDatabase,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          ok: false,
          error: "Email and password are required",
        });
      }

      const normalizedEmail = normalizeEmail(email);

      /*
      |--------------------------------------------------------------
      | CHECK ADMIN FIRST
      |--------------------------------------------------------------
      */

      const admin = ADMIN_ACCOUNTS.find(
        (item) =>
          item.email === normalizedEmail &&
          item.password === password
      );

      if (admin) {
        const token = jwt.sign(
          {
            id: `admin-${normalizedEmail}`,
            email: normalizedEmail,
            role: "admin",
          },
          JWT_SECRET,
          {
            expiresIn: "7d",
          }
        );

        return res.json({
          ok: true,
          token,
          user: {
            id: `admin-${normalizedEmail}`,
            email: normalizedEmail,
            role: "admin",
          },
        });
      }

      /*
      |--------------------------------------------------------------
      | NORMAL USER LOGIN
      |--------------------------------------------------------------
      */

      const user = await db.collection("users").findOne({
        email: normalizedEmail,
      });

      if (!user) {
        return res.status(401).json({
          ok: false,
          error: "Invalid email or password",
        });
      }

      const passwordMatch = await bcrypt.compare(
        password,
        user.password
      );

      if (!passwordMatch) {
        return res.status(401).json({
          ok: false,
          error: "Invalid email or password",
        });
      }

      const token = jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          role: "user",
        },
        JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

      return res.json({
        ok: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          role: "user",
        },
      });
    } catch (error) {
      console.error("Login error:", error);

      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| AUTH - GET CURRENT USER
|--------------------------------------------------------------------------
*/

app.get(
  "/api/auth/me",
  authenticateToken,
  async (req, res) => {
    try {
      return res.json({
        ok: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
        },
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
|--------------------------------------------------------------------------
| AUTH - RESET PASSWORD
|--------------------------------------------------------------------------
|
| Normal users can reset their own password.
| Admin accounts are not stored in the users collection.
|--------------------------------------------------------------------------
*/

app.post(
  "/api/auth/reset-password",
  requireDatabase,
  async (req, res) => {
    try {
      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({
          ok: false,
          error:
            "Email and new password are required",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          ok: false,
          error:
            "Password must contain at least 6 characters",
        });
      }

      const normalizedEmail = normalizeEmail(email);

      if (isAdminEmail(normalizedEmail)) {
        return res.status(403).json({
          ok: false,
          error:
            "Admin passwords must be changed in server configuration",
        });
      }

      const user = await db.collection("users").findOne({
        email: normalizedEmail,
      });

      if (!user) {
        return res.status(404).json({
          ok: false,
          error:
            "No account found with this email",
        });
      }

      const hashedPassword = await bcrypt.hash(
        newPassword,
        10
      );

      await db.collection("users").updateOne(
        {
          email: normalizedEmail,
        },
        {
          $set: {
            password: hashedPassword,
            updatedAt: new Date(),
          },
        }
      );

      return res.json({
        ok: true,
        message:
          "Password updated successfully! Please sign in.",
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
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mongodb: !!db,
    database: db ? db.databaseName : null,
    service: "AI Query Performance Advisor",
  });
});

/*
|--------------------------------------------------------------------------
| USER - ANALYZE SQL
|--------------------------------------------------------------------------
|
| IMPORTANT:
| We no longer accept userEmail from the frontend.
| The email comes from the verified JWT.
|--------------------------------------------------------------------------
*/

app.post(
  "/api/analyze",
  authenticateToken,
  requireDatabase,
  async (req, res) => {
    try {
      if (req.user.role !== "user") {
        return res.status(403).json({
          ok: false,
          error:
            "Only normal users can perform SQL analysis",
        });
      }

      const sql = String(req.body.sql || "");

      const title =
        req.body.title ||
        "SQL Performance Analysis";

      const analysis = analyzeSQL(sql);

      const report = reportDocument({
        title,
        sql,
        analysis,

        /*
        |--------------------------------------------------------------
        | USER IS TAKEN FROM JWT
        |--------------------------------------------------------------
        */

        userEmail: req.user.email,

        /*
        |--------------------------------------------------------------
        | OPTIONAL USER ID
        |--------------------------------------------------------------
        */

        userId: req.user.id,
      });

      /*
      |--------------------------------------------------------------
      | ADD USER ID / EMAIL TO REPORT
      |--------------------------------------------------------------
      */

      report.userEmail = req.user.email;
      report.userId = req.user.id;

      await db.collection("reports").insertOne(report);

      return res.json({
        ok: true,
        report,
      });
    } catch (error) {
      console.error("Analyze error:", error);

      return res.status(400).json({
        ok: false,
        error: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| USER - GET OWN REPORTS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/reports",
  authenticateToken,
  requireDatabase,
  async (req, res) => {
    try {
      if (req.user.role !== "user") {
        return res.status(403).json({
          ok: false,
          error:
            "Use the admin reports endpoint for administrator access",
        });
      }

      const reports = await db
        .collection("reports")
        .find({
          userEmail: req.user.email,
        })
        .sort({
          createdAt: -1,
        })
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
|--------------------------------------------------------------------------
| USER - GET OWN STATS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/stats",
  authenticateToken,
  requireDatabase,
  async (req, res) => {
    try {
      if (req.user.role !== "user") {
        return res.status(403).json({
          ok: false,
          error: "User access required",
        });
      }

      const docs = await db
        .collection("reports")
        .find(
          {
            userEmail: req.user.email,
          },
          {
            projection: {
              "analysis.performanceScore": 1,
              "analysis.riskLevel": 1,
            },
          }
        )
        .toArray();

      const total = docs.length;

      const averageScore = total
        ? Math.round(
            docs.reduce(
              (sum, doc) =>
                sum +
                (doc.analysis?.performanceScore || 0),
              0
            ) / total
          )
        : 0;

      const highRisk = docs.filter(
        (doc) =>
          doc.analysis?.riskLevel === "High"
      ).length;

      return res.json({
        ok: true,
        total,
        averageScore,
        highRisk,
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
|--------------------------------------------------------------------------
| ADMIN - GET ALL USERS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/admin/users",
  authenticateToken,
  requireAdmin,
  requireDatabase,
  async (req, res) => {
    try {
      const users = await db
        .collection("users")
        .find(
          {},
          {
            projection: {
              password: 0,
            },
          }
        )
        .sort({
          createdAt: -1,
        })
        .toArray();

      return res.json({
        ok: true,
        users,
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
|--------------------------------------------------------------------------
| ADMIN - GET ALL REPORTS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/admin/reports",
  authenticateToken,
  requireAdmin,
  requireDatabase,
  async (req, res) => {
    try {
      const filter = {};

      /*
      |--------------------------------------------------------------
      | ADMIN CAN FILTER BY PARTICULAR USER
      |
      | Example:
      | /api/admin/reports?userEmail=test@gmail.com
      |--------------------------------------------------------------
      */

      if (req.query.userEmail) {
        filter.userEmail = normalizeEmail(
          req.query.userEmail
        );
      }

      const reports = await db
        .collection("reports")
        .find(filter)
        .sort({
          createdAt: -1,
        })
        .limit(500)
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
|--------------------------------------------------------------------------
| ADMIN - GET REPORTS OF PARTICULAR USER
|--------------------------------------------------------------------------
*/

app.get(
  "/api/admin/users/:email/reports",
  authenticateToken,
  requireAdmin,
  requireDatabase,
  async (req, res) => {
    try {
      const userEmail = normalizeEmail(
        decodeURIComponent(req.params.email)
      );

      const reports = await db
        .collection("reports")
        .find({
          userEmail,
        })
        .sort({
          createdAt: -1,
        })
        .limit(500)
        .toArray();

      return res.json({
        ok: true,
        userEmail,
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
|--------------------------------------------------------------------------
| ADMIN - DASHBOARD STATISTICS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/admin/stats",
  authenticateToken,
  requireAdmin,
  requireDatabase,
  async (req, res) => {
    try {
      const totalUsers =
        await db.collection("users").countDocuments();

      const totalReports =
        await db.collection("reports").countDocuments();

      const allReports = await db
        .collection("reports")
        .find(
          {},
          {
            projection: {
              "analysis.performanceScore": 1,
              "analysis.riskLevel": 1,
            },
          }
        )
        .toArray();

      const averageScore = allReports.length
        ? Math.round(
            allReports.reduce(
              (sum, doc) =>
                sum +
                (doc.analysis?.performanceScore || 0),
              0
            ) / allReports.length
          )
        : 0;

      const highRisk = allReports.filter(
        (doc) =>
          doc.analysis?.riskLevel === "High"
      ).length;

      const mediumRisk = allReports.filter(
        (doc) =>
          doc.analysis?.riskLevel === "Medium"
      ).length;

      const lowRisk = allReports.filter(
        (doc) =>
          doc.analysis?.riskLevel === "Low"
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
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN - PARTICULAR USER STATISTICS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/admin/user-stats/:email",
  authenticateToken,
  requireAdmin,
  requireDatabase,
  async (req, res) => {
    try {
      const userEmail = normalizeEmail(
        decodeURIComponent(req.params.email)
      );

      const reports = await db
        .collection("reports")
        .find({
          userEmail,
        })
        .toArray();

      const total = reports.length;

      const averageScore = total
        ? Math.round(
            reports.reduce(
              (sum, report) =>
                sum +
                (report.analysis?.performanceScore || 0),
              0
            ) / total
          )
        : 0;

      const highRisk = reports.filter(
        (report) =>
          report.analysis?.riskLevel === "High"
      ).length;

      const mediumRisk = reports.filter(
        (report) =>
          report.analysis?.riskLevel === "Medium"
      ).length;

      const lowRisk = reports.filter(
        (report) =>
          report.analysis?.riskLevel === "Low"
      ).length;

      return res.json({
        ok: true,
        userEmail,
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
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

async function start() {
  try {
    const rawUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017";

    const client = new MongoClient(rawUri);

    await client.connect();

    const targetDbName =
      process.env.MONGODB_DB ||
      "query_performance_advisors";

    db = client.db(targetDbName);

    /*
    |--------------------------------------------------------------
    | DATABASE INDEXES
    |--------------------------------------------------------------
    */

    await db.collection("reports").createIndex({
      createdAt: -1,
    });

    await db.collection("reports").createIndex({
      userEmail: 1,
      createdAt: -1,
    });

    await db.collection("users").createIndex(
      {
        email: 1,
      },
      {
        unique: true,
      }
    );

    console.log(
      "MongoDB connected successfully to DB:",
      db.databaseName
    );

    console.log(
      "Admin accounts configured:",
      ADMIN_ACCOUNTS.map(
        (admin) => admin.email
      )
    );
  } catch (error) {
    console.error(
      "MongoDB Connection Failed:",
      error.message
    );
  }

  app.listen(PORT, () => {
    console.log(
      `API running at http://localhost:${PORT}`
    );
  });
}

start();