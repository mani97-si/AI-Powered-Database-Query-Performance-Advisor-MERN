import jsPDF from "jspdf";

/**
 * Draws border, top branding banner, and footer metadata on every page.
 */
function applyPageDecorations(doc, { userEmail, userName }) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const formattedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const displayName = userName || userEmail || "Anonymous User";

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // 1. Outer Page Border (Margins: 7mm)
    doc.setDrawColor(30, 41, 59); // Slate border color
    doc.setLineWidth(0.8);
    doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

    // Optional subtle inner thin accent border
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.2);
    doc.rect(8.5, 8.5, pageWidth - 17, pageHeight - 17);

    // 2. Top Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(8.5, 8.5, pageWidth - 17, 18, "F");

    // Brand Name
    doc.setTextColor(34, 197, 94); // Accent Green
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("QueryPilot", 12, 18);

    doc.setTextColor(148, 163, 184); // Slate muted
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("AI Database Query Performance Advisor", 12, 23);

    // User & Date on Header Right
    doc.setTextColor(241, 245, 249);
    doc.setFontSize(8);
    doc.text(`User: ${displayName}`, pageWidth - 12, 16, { align: "right" });
    doc.text(`Generated: ${formattedDate}`, pageWidth - 12, 22, { align: "right" });

    // 3. Bottom Footer with Page Numbers
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(10, pageHeight - 14, pageWidth - 10, pageHeight - 14);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text("QueryPilot Confidential & Generated Report", 12, pageHeight - 10);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 12, pageHeight - 10, { align: "right" });
  }
}

export function exportAnalysisPDF({ report, userEmail, userName }) {
  const doc = new jsPDF();

  // Content starts below the header banner (y = 35)
  let y = 35;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(report.title || "SQL Performance Report", 14, y);

  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Query Analyzed:`, 14, y);

  y += 6;
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  const sqlLines = doc.splitTextToSize(report.sql || "N/A", doc.internal.pageSize.getWidth() - 28);
  doc.text(sqlLines, 14, y);

  // --- Add any autoTable or metric sections here ---

  // Apply borders, header banner, and footer to ALL pages
  applyPageDecorations(doc, { userEmail, userName });

  const fileName = `${(report.title || "Report").replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}