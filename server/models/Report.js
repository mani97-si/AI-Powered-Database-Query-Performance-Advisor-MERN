function reportDocument({ title, sql, analysis, userName, userEmail, createdAt = new Date() }) {
  return {
    appName: "QueryPilot",
    userName: userName || userEmail?.split("@")[0] || "User",
    userEmail,
    title,
    sql,
    analysis,
    createdAt,
  };
}

module.exports = { reportDocument };