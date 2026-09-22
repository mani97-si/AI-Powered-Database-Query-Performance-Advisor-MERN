# ⚡ QueryPilot — AI-Powered Database Query Performance Advisor (MERN)

[![Live Demo](https://img.shields.io/badge/Demo-Live%20on%20Vercel-black?style=for-the-badge&logo=vercel)](https://client-black-pi-23.vercel.app)
[![Backend Status](https://img.shields.io/badge/Backend-Render%20Live-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://ai-powered-database-query-performance.onrender.com)
[![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://cloud.mongodb.com)

An explainable, rule-based SQL performance advisor and DBA diagnostic platform built with the MERN stack. QueryPilot inspects queries, flags anti-patterns, recommends composite indexes, scores workload risk, and exports DBA audit reports.

🔗 **Live Production Application:** [client-black-pi-23.vercel.app](https://client-black-pi-23.vercel.app)  
🔗 **Live Backend API:** [ai-powered-database-query-performance.onrender.com](https://ai-powered-database-query-performance.onrender.com)

---

## 🛠️ Tech Stack

- **Frontend:** React (Vite), Modern Responsive UI, jsPDF, Lucide Icons
- **Backend:** Node.js, Express.js REST API
- **Database:** MongoDB Atlas via Mongoose
- **Authentication:** JWT (JSON Web Tokens) & bcrypt.js password hashing
- **Deployment:** Vercel (Client SPA) & Render (Node Web Service)

---

## ✨ Features

- **SQL Query Analysis Engine:** Tokenizes and evaluates SQL queries for common performance anti-patterns.
- **Explainable Performance Scoring:** Calculates health scores (0–100) and assigns categorized risk levels (Low, Medium, High).
- **Anti-Pattern & Bottleneck Detection:**
  - `SELECT *` unindexed overhead detection
  - Leading wildcard searches (`LIKE '%...'`) causing full table scans
  - Functions applied directly to filter columns (`LOWER()`, `UPPER()`) invalidating standard B-Tree index lookups
  - Missing or unbounded sorting (`ORDER BY` without `LIMIT`)
  - Cartesians and unindexed joins
- **DBA Index Recommendations:** Auto-generates exact composite index DDL statements tailored to detected filter and join predicates.
- **Cloud Audit History:** Persists analysis history, query inputs, and diagnostic metrics directly in MongoDB Atlas.
- **Exportable DBA Reports:** Client-side generation of structured diagnostic reports in PDF format.
- **Multi-Tenant Authentication:** User registration, credential security, and user-isolated query audits.

---

## 📁 Project Architecture

```text
AI-Powered-Database-Query-Performance-Advisor-MERN/
├── client/                     # Frontend React (Vite) application
│   ├── src/
│   │   ├── components/         # Modular UI blocks (Auth, Dashboard, Workbench)
│   │   ├── App.jsx             # Root view & API routing
│   │   └── main.jsx            # Application entry
│   ├── package.json
│   └── vite.config.js
├── server/                     # Backend Node / Express API
│   ├── models/                 # Mongoose schemas (User, Report)
│   ├── services/
│   │   └── analyzer.js         # Core query diagnostic & rule engine
│   ├── server.js               # Express application entry & endpoints
│   ├── .env.example            # Environment variables blueprint
│   └── package.json
├── package.json                # Monorepo root scripts
└── README.md