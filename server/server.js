require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "query_advisor_super_secret_jwt_key_2026_secure";

const PORT = Number(process.env.PORT || 5000);

/*
  Admin accounts

  Recommended:
  Put these values in your .env file.

  ADMIN_EMAIL_1=admin@demo.edu
  ADMIN_PASSWORD_1=Admin@123

  ADMIN_EMAIL_2=admin2@demo.edu
  ADMIN_PASSWORD_2=Admin@456

  The defaults below are only for development/testing.
*/

const ADMIN_ACCOUNTS = [
  {
    email: (
      process.env.ADMIN_EMAIL_1 || "admin@demo.edu"
    )
      .toLowerCase()
      .trim(),

    password:
      process.env.ADMIN_PASSWORD_1 || "Admin@123",
  },

  {
    email: (
      process.env.ADMIN_EMAIL_2 || "admin2@demo.edu"
    )
      .toLowerCase()
      .trim(),

    password:
      process.env.ADMIN_PASSWORD_2 || "Admin@456",
  },
];

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function createToken(user) {
  return jwt.sign(
    {
      id: user.id || null,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

function publicUser(user) {
  return {
    id: user.id || user._id?.toString() || null,
    email: user.email,
    role: user.role || "user",
  };
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

    const token = authHeader.substring(7);

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
  if (!req.user || req.user.role !== "admin") {
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

/* =========================================================
   AUTHENTICATION
========================================================= */

/*
  REGISTER NORMAL USER
*/

app.post("/api/auth/register", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database not connected",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email and password are required",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        ok: false,
        error: "Password must contain at least 6 characters",
      });
    }

    const normalizedEmail = String(email)
      .toLowerCase()
      .trim();

    /*
      Admin accounts cannot be registered
      as normal users.
    */

    if (isConfiguredAdmin(normalizedEmail)) {
      return res.status(400).json({
        ok: false,
        error:
          "This email is reserved for an administrator account",
      });
    }

    const existing = await db
      .collection("users")
      .findOne({
        email: normalizedEmail,
      });

    if (existing) {
      return res.status(400).json({
        ok: false,
        error:
          "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const result = await db.collection("users").insertOne({
      email: normalizedEmail,
      password: hashedPassword,
      role: "user",
      createdAt: new Date(),
    });

    const user = {
      id: result.insertedId.toString(),
      email: normalizedEmail,
      role: "user",
    };

    const token = createToken(user);

    return res.json({
      ok: true,
      token,
      user,
    });
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  LOGIN

  Supports both:
  - Normal users from MongoDB
  - Two configured admin accounts
*/

app.post("/api/auth/login", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database not connected",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email and password are required",
      });
    }

    const normalizedEmail = String(email)
      .toLowerCase()
      .trim();

    /* =====================================================
       ADMIN LOGIN
    ===================================================== */

    const adminAccount =
      getAdminAccount(normalizedEmail);

    if (adminAccount) {
      const adminPasswordMatch =
        String(password) ===
        String(adminAccount.password);

      if (!adminPasswordMatch) {
        return res.status(400).json({
          ok: false,
          error: "Invalid email or password",
        });
      }

      const adminUser = {
        id: `admin-${normalizedEmail}`,
        email: normalizedEmail,
        role: "admin",
      };

      const token = createToken(adminUser);

      return res.json({
        ok: true,
        token,
        user: adminUser,
      });
    }

    /* =====================================================
       NORMAL USER LOGIN
    ===================================================== */

    const user = await db
      .collection("users")
      .findOne({
        email: normalizedEmail,
      });

    if (!user) {
      return res.status(400).json({
        ok: false,
        error: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        ok: false,
        error: "Invalid email or password",
      });
    }

    const normalUser = {
      id: user._id.toString(),
      email: user.email,
      role:
        user.role === "admin"
          ? "admin"
          : "user",
    };

    const token = createToken(normalUser);

    return res.json({
      ok: true,
      token,
      user: normalUser,
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  CURRENT USER
*/

app.get(
  "/api/auth/me",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role === "admin") {
        return res.json({
          ok: true,
          user: {
            id: req.user.id,
            email: req.user.email,
            role: "admin",
          },
        });
      }

      if (!db) {
        return res.status(503).json({
          ok: false,
          error: "Database not connected",
        });
      }

      const user = await db
        .collection("users")
        .findOne({
          email: req.user.email,
        });

      if (!user) {
        return res.status(401).json({
          ok: false,
          error: "User account no longer exists",
        });
      }

      return res.json({
        ok: true,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: "user",
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
  RESET PASSWORD
*/

app.post(
  "/api/auth/reset-password",
  async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({
          ok: false,
          error: "Database not connected",
        });
      }

      const { email, newPassword } =
        req.body;

      if (!email || !newPassword) {
        return res.status(400).json({
          ok: false,
          error:
            "Email and new password are required",
        });
      }

      if (String(newPassword).length < 6) {
        return res.status(400).json({
          ok: false,
          error:
            "New password must contain at least 6 characters",
        });
      }

      const normalizedEmail = String(email)
        .toLowerCase()
        .trim();

      /*
        Admin passwords are configured through
        environment variables, so normal reset
        does not modify them.
      */

      if (isConfiguredAdmin(normalizedEmail)) {
        return res.status(400).json({
          ok: false,
          error:
            "Administrator passwords must be changed in server configuration",
        });
      }

      const user = await db
        .collection("users")
        .findOne({
          email: normalizedEmail,
        });

      if (!user) {
        return res.status(404).json({
          ok: false,
          error:
            "No account found with this email",
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          newPassword,
          10
        );

      await db
        .collection("users")
        .updateOne(
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

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mongodb: !!db,
    database: db
      ? db.databaseName
      : null,
    service:
      "AI Query Performance Advisor",
  });
});

/* =========================================================
   SQL ANALYSIS
========================================================= */

app.post(
  "/api/analyze",
  authenticateToken,
  requireUser,
  async (req, res) => {
    try {
      const sql = String(
        req.body.sql || ""
      );

      if (!sql.trim()) {
        return res.status(400).json({
          ok: false,
          error:
            "SQL query is required",
        });
      }

      /*
        IMPORTANT:
        Use the authenticated user's email.
        Do not trust userEmail from frontend.
      */

      const userEmail =
        req.user.email;

      const analysis =
        analyzeSQL(sql);

      const report =
        reportDocument({
          title:
            req.body.title ||
            "SQL Performance Analysis",

          sql,

          analysis,

          userEmail,
        });

      if (db) {
        await db
          .collection("reports")
          .insertOne(report);
      }

      return res.json({
        ok: true,
        report,
      });
    } catch (error) {
      console.error(
        "Analysis error:",
        error
      );

      return res.status(400).json({
        ok: false,
        error: error.message,
      });
    }
  }
);

/* =========================================================
   USER REPORTS
========================================================= */

app.get(
  "/api/reports",
  authenticateToken,
  requireUser,
  async (req, res) => {
    try {
      if (!db) {
        return res.json({
          ok: true,
          reports: [],
        });
      }

      const userEmail =
        req.user.email;

      const reports =
        await db
          .collection("reports")
          .find({
            userEmail,
          })
          .sort({
            createdAt: -1,
          })
          .limit(25)
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

/* =========================================================
   USER STATS
========================================================= */

app.get(
  "/api/stats",
  authenticateToken,
  requireUser,
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

      const userEmail =
        req.user.email;

      const docs =
        await db
          .collection("reports")
          .find(
            { userEmail },
            {
              projection: {
                "analysis.performanceScore": 1,
                "analysis.riskLevel": 1,
              },
            }
          )
          .toArray();

      const total =
        docs.length;

      const averageScore =
        total
          ? Math.round(
              docs.reduce(
                (sum, doc) =>
                  sum +
                  Number(
                    doc.analysis
                      ?.performanceScore ||
                      0
                  ),
                0
              ) / total
            )
          : 0;

      const highRisk =
        docs.filter(
          (doc) =>
            doc.analysis
              ?.riskLevel ===
            "High"
        ).length;

      const mediumRisk =
        docs.filter(
          (doc) =>
            doc.analysis
              ?.riskLevel ===
            "Medium"
        ).length;

      const lowRisk =
        docs.filter(
          (doc) =>
            doc.analysis
              ?.riskLevel ===
            "Low"
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
  }
);

/* =========================================================
   ADMIN STATS
========================================================= */

app.get(
  "/api/admin/stats",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
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

      const totalUsers =
        await db
          .collection("users")
          .countDocuments();

      const reports =
        await db
          .collection("reports")
          .find({})
          .project({
            "analysis.performanceScore": 1,
            "analysis.riskLevel": 1,
          })
          .toArray();

      const totalReports =
        reports.length;

      const averageScore =
        totalReports
          ? Math.round(
              reports.reduce(
                (sum, doc) =>
                  sum +
                  Number(
                    doc.analysis
                      ?.performanceScore ||
                      0
                  ),
                0
              ) / totalReports
            )
          : 0;

      const highRisk =
        reports.filter(
          (doc) =>
            doc.analysis
              ?.riskLevel ===
            "High"
        ).length;

      const mediumRisk =
        reports.filter(
          (doc) =>
            doc.analysis
              ?.riskLevel ===
            "Medium"
        ).length;

      const lowRisk =
        reports.filter(
          (doc) =>
            doc.analysis
              ?.riskLevel ===
            "Low"
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

/* =========================================================
   ADMIN USERS
========================================================= */

app.get(
  "/api/admin/users",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      if (!db) {
        return res.json({
          ok: true,
          users: [],
        });
      }

      const users =
        await db
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

      const formattedUsers =
        users.map((user) => ({
          id: user._id.toString(),
          email: user.email,
          role: "user",
          createdAt:
            user.createdAt,
        }));

      /*
        Add configured admins to the
        admin users list.
      */

      const adminUsers =
        ADMIN_ACCOUNTS.map(
          (admin, index) => ({
            id: `admin-${index + 1}`,
            email: admin.email,
            role: "admin",
            createdAt: null,
          })
        );

      return res.json({
        ok: true,
        users: [
          ...adminUsers,
          ...formattedUsers,
        ],
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  }
);

/* =========================================================
   ADMIN ALL REPORTS
========================================================= */

app.get(
  "/api/admin/reports",
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

      const reports =
        await db
          .collection("reports")
          .find({})
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

/* =========================================================
   ADMIN USER REPORTS
========================================================= */

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

      const email = decodeURIComponent(
        req.params.email
      )
        .toLowerCase()
        .trim();

      const reports =
        await db
          .collection("reports")
          .find({
            userEmail: email,
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

/* =========================================================
   ADMIN USER STATS
========================================================= */

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

      const email = decodeURIComponent(
        req.params.email
      )
        .toLowerCase()
        .trim();

      const docs =
        await db
          .collection("reports")
          .find({
            userEmail: email,
          })
          .project({
            "analysis.performanceScore": 1,
            "analysis.riskLevel": 1,
          })
          .toArray();

      const total =
        docs.length;

      const averageScore =
        total
          ? Math.round(
              docs.reduce(
                (sum, doc) =>
                  sum +
                  Number(
                    doc.analysis
                      ?.performanceScore ||
                      0
                  ),
                0
              ) / total
            )
          : 0;

      const highRisk =
        docs.filter(
          (doc) =>
            doc.analysis
              ?.riskLevel ===
            "High"
        ).length;

      const mediumRisk =
        docs.filter(
          (doc) =>
            doc.analysis
              ?.riskLevel ===
            "Medium"
        ).length;

      const lowRisk =
        docs.filter(
          (doc) =>
            doc.analysis
              ?.riskLevel ===
            "Low"
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

/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service:
      "AI Query Performance Advisor API",
  });
});

/* =========================================================
   START SERVER
========================================================= */

async function start() {
  try {
    const rawUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017";

    const client =
      new MongoClient(rawUri);

    await client.connect();

    const targetDbName =
      process.env.MONGODB_DB ||
      "query_performance_advisors";

    db = client.db(
      targetDbName
    );

    /*
      Indexes
    */

    await db
      .collection("reports")
      .createIndex({
        createdAt: -1,
      });

    await db
      .collection("reports")
      .createIndex({
        userEmail: 1,
        createdAt: -1,
      });

    await db
      .collection("users")
      .createIndex(
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
  } catch (error) {
    console.error(
      "MongoDB Connection Failed:",
      error.message
    );
  }

  app.listen(
    PORT,
    () => {
      console.log(
        `API running at http://localhost:${PORT}`
      );

      console.log(
        "Configured admin accounts:"
      );

      ADMIN_ACCOUNTS.forEach(
        (admin) => {
          console.log(
            ` - ${admin.email}`
          );
        }
      );
    }
  );
}

start();