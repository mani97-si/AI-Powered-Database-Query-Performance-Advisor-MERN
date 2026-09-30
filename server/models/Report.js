const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  query: {
    type: String,
    required: true
  },
  databaseType: {
    type: String,
    enum: ['MySQL', 'PostgreSQL', 'MongoDB', 'SQL'],
    default: 'MySQL'
  },
  executionTime: {
    type: mongoose.Schema.Types.Mixed,
    default: 0
  },
  cost: {
    type: mongoose.Schema.Types.Mixed,
    default: 0
  },
  recommendations: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  appName: {
    type: String,
    default: "QueryPilot"
  },
  userName: {
    type: String,
    default: "User"
  },
  userEmail: {
    type: String
  },
  title: {
    type: String
  },
  sql: {
    type: String
  },
  analysis: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

function reportDocument({ 
  userId, 
  query, 
  databaseType = "MySQL", 
  executionTime, 
  cost, 
  recommendations, 
  title, 
  sql, 
  analysis, 
  userName, 
  userEmail, 
  createdAt = new Date() 
}) {
  const finalQuery = query || sql || "";
  const finalRecommendations = recommendations || analysis?.indexes || analysis?.findings || [];
  const finalCost = cost !== undefined ? cost : analysis?.performanceScore || 0;
  const finalTime = executionTime !== undefined ? executionTime : analysis?.executionEstimate || "1.2s";

  return {
    appName: "QueryPilot",
    userId: userId || null,
    query: finalQuery,
    databaseType: databaseType || "MySQL",
    executionTime: finalTime,
    cost: finalCost,
    recommendations: finalRecommendations,
    userName: userName || userEmail?.split("@")[0] || "User",
    userEmail,
    title: title || "SQL Performance Analysis",
    sql: finalQuery,
    analysis,
    createdAt,
  };
}

let ReportModel;
try {
  ReportModel = mongoose.model('Report', reportSchema);
} catch (e) {
  ReportModel = mongoose.models.Report;
}

module.exports = { reportDocument, Report: ReportModel };