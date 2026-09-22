# AI-Powered Database Query Performance Advisor — MERN

A complete MERN Stack project for analyzing SQL queries, detecting common performance bottlenecks, recommending indexes, and generating optimization reports.

## Stack
- MongoDB — report storage
- Express.js — REST API
- React.js — dashboard UI
- Node.js — backend runtime

## Features
- SQL query editor
- AI-inspired explainable rule engine
- Performance score
- Risk level
- Bottleneck detection
- Index recommendations
- Optimization recommendations
- DBA report generation/download
- MongoDB report history
- Dashboard statistics

## Requirements
Node.js 18+
MongoDB local or MongoDB Atlas

## Setup
1. Open terminal in this project.
2. Install root dependency:
   `npm install`
3. Install backend/frontend:
   `npm run install-all`
4. Copy `server/.env.example` to `server/.env`.
5. Set MongoDB URI if needed.
6. Start:
   `npm run dev`

Frontend: http://localhost:5173
Backend: http://localhost:5000

## Sample query
SELECT *
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE LOWER(c.email) LIKE '%gmail.com'
  AND o.status = 'completed'
ORDER BY o.created_at DESC;

## Note
The analysis engine is an explainable rule-based AI-style advisor. It does not execute arbitrary SQL against production databases. A production version can consume EXPLAIN/EXPLAIN ANALYZE output and add an ML/LLM model.
