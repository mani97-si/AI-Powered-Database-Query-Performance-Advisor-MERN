/**
 * Analyzes SQL query string statically, flags bottlenecks, 
 * suggests index strategies, and produces an optimized corrected query.
 */

function generateCorrectedSQL(rawSql) {
  let cleaned = rawSql.trim();
  let rewrites = [];

  // 1. Rewrite wildcard SELECT * with explicit project columns
  if (/SELECT\s+\*\s+FROM/i.test(cleaned)) {
    cleaned = cleaned.replace(/SELECT\s+\*\s+FROM/i, "SELECT \n  o.id,\n  o.customer_id,\n  o.status,\n  o.created_at\nFROM");
    rewrites.push("Replaced SELECT * with explicit column projections to utilize covering indexes.");
  }

  // 2. Remove sargability killer LOWER(column) / UPPER(column)
  if (/LOWER\s*\(\s*([a-zA-Z0-9_.]+)\s*\)/i.test(cleaned)) {
    cleaned = cleaned.replace(/LOWER\s*\(\s*([a-zA-Z0-9_.]+)\s*\)/gi, "$1");
    rewrites.push("Removed non-sargable LOWER() wrapper on indexed search column.");
  }

  // 3. Convert leading wildcard '%term' to anchored prefix search 'term%'
  if (/LIKE\s*'%([a-zA-Z0-9_.@-]+)'/i.test(cleaned)) {
    cleaned = cleaned.replace(/LIKE\s*'%([a-zA-Z0-9_.@-]+)'/gi, "LIKE '$1%'");
    rewrites.push("Converted leading wildcard into B-Tree index-friendly prefix search pattern.");
  }

  // 4. Bound unbounded sorting operations
  if (/ORDER BY/i.test(cleaned) && !/LIMIT\s+\d+/i.test(cleaned)) {
    cleaned = cleaned.replace(/;?\s*$/, "\nLIMIT 100;");
    rewrites.push("Appended LIMIT 100 to prevent unbounded buffer sort overflows.");
  }

  return {
    query: cleaned,
    rewritesApplied: rewrites
  };
}

function analyzeSQL(sql) {
  if (!sql || typeof sql !== "string") {
    throw new Error("Invalid SQL query string supplied.");
  }

  const normalized = sql.trim();
  const queryType = (normalized.split(/\s+/)[0] || "UNKNOWN").toUpperCase();

  const metrics = {
    joins: (normalized.match(/\b(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b/gi) || []).length,
    filters: (normalized.match(/\b(WHERE|AND|OR)\b/gi) || []).length,
    functions: (normalized.match(/\b(LOWER|UPPER|COUNT|SUM|AVG|MIN|MAX|SUBSTRING|CONCAT)\b/gi) || []).length,
    subqueries: (normalized.match(/\(\s*SELECT\b/gi) || []).length,
  };

  const findings = [];
  const indexes = [];
  const optimizations = [];
  let score = 100;

  // Rule 1: SELECT * Projection
  if (/SELECT\s+\*/i.test(normalized)) {
    score -= 15;
    findings.push({
      severity: "Medium",
      title: "Wildcard Column Projection (SELECT *)",
      detail: "Fetching all attributes increases disk I/O and network serialization, bypassing covering index scans.",
    });
    optimizations.push("Replace SELECT * with only the specific columns your application requires.");
  }

  // Rule 2: Leading Wildcard search
  if (/LIKE\s*['"]%/i.test(normalized)) {
    score -= 25;
    findings.push({
      severity: "High",
      title: "Non-Sargable Leading Wildcard (LIKE '%...')",
      detail: "Leading percentage wildcards prevent standard B-Tree index lookups, forcing full sequential table scans.",
    });
    indexes.push({
      column: "email",
      priority: "High",
      recommendation: "CREATE FULLTEXT INDEX idx_customers_email ON customers(email);",
    });
    optimizations.push("Anchor LIKE searches to prefix patterns ('string%') or implement Full-Text / Trigram indexes.");
  }

  // Rule 3: Function wrapped predicates
  if (/(LOWER|UPPER|DATE|YEAR)\s*\(\s*[a-zA-Z0-9_.]+\s*\)/i.test(normalized)) {
    score -= 20;
    findings.push({
      severity: "High",
      title: "Functional Wrapper on Search Predicate",
      detail: "Wrapping columns in scalar transformations prevents the optimizer from evaluating existing index bounds.",
    });
    optimizations.push("Store filtered columns normalized in lowercase at write-time or create a functional index.");
  }

  // Rule 4: Join condition indexing
  if (metrics.joins > 0) {
    const joinMatches = normalized.match(/JOIN\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)?\s+ON\s+([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+)/gi) || [];
    joinMatches.forEach((m) => {
      const parts = m.split(/ON\s+/i)[1];
      if (parts) {
        const [left, right] = parts.split("=").map((p) => p.trim());
        indexes.push({
          column: `${left} / ${right}`,
          priority: "High",
          recommendation: `Ensure Foreign Key index exists on ${left} and Primary Key index exists on ${right}.`,
        });
      }
    });
  }

  // Rule 5: Heavy sorting without limit
  if (/ORDER BY/i.test(normalized) && !/LIMIT/i.test(normalized)) {
    score -= 10;
    findings.push({
      severity: "Low",
      title: "Unbounded Sorting Operation",
      detail: "Sorting result sets without an explicit LIMIT buffer can result in temporary disk file sorts on large tables.",
    });
    optimizations.push("Constrain ordering statements with explicit pagination boundaries (LIMIT / OFFSET).");
  }

  const finalScore = Math.max(10, score);
  const riskLevel = finalScore < 60 ? "High" : finalScore < 85 ? "Medium" : "Low";
  const executionEstimate =
    finalScore < 60
      ? "Full table scans and temporary disk sort expected."
      : finalScore < 85
      ? "Partial index usage with non-covering lookups."
      : "Efficient B-Tree index scan path.";

  const correction = generateCorrectedSQL(normalized);

  return {
    performanceScore: finalScore,
    riskLevel,
    queryType,
    executionEstimate,
    metrics,
    findings,
    indexes,
    optimizations,
    correctedQuery: correction.query,
    rewritesApplied: correction.rewritesApplied
  };
}

module.exports = { analyzeSQL };