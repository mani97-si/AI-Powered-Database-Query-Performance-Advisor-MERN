/**
 * Factory function for creating a normalized report document.
 * Includes userEmail for multi-tenant account scoping.
 */
function reportDocument({ title, sql, analysis, userEmail }) {
  return {
    title: title || "SQL Performance Analysis",
    sql: sql ? String(sql).trim() : "",
    analysis: analysis || {},
    userEmail: userEmail ? String(userEmail).toLowerCase().trim() : null,
    createdAt: new Date(),
  };
}

module.exports = { reportDocument };