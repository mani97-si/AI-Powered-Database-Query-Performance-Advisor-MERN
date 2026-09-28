/**
 * Factory function for creating a normalized report document.
 * Stores both userId and userEmail for secure user/admin reporting.
 */

function reportDocument({
  title,
  sql,
  analysis,
  userEmail,
  userId,
}) {
  return {
    title: title || "SQL Performance Analysis",

    sql: sql ? String(sql).trim() : "",

    analysis: analysis || {},

    userId: userId ? String(userId) : null,

    userEmail: userEmail
      ? String(userEmail).toLowerCase().trim()
      : null,

    createdAt: new Date(),
  };
}

module.exports = {
  reportDocument,
};