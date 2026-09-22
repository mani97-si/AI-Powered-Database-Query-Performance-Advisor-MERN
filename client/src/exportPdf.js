import jsPDF from 'jspdf';

export const exportReportToPDF = ({ query, analysis }) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = 18;

  const checkPageBreak = (neededHeight) => {
    if (yPos + neededHeight > 275) {
      doc.addPage();
      yPos = 18;
    }
  };

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 24, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('AI Query Performance Advisor Report', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, 18);

  yPos = 32;

  // Analyzed Query
  if (query) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Analyzed SQL Query:', margin, yPos);
    yPos += 6;

    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(14, 116, 144);
    
    const queryLines = doc.splitTextToSize(query, contentWidth);
    doc.text(queryLines, margin, yPos);
    yPos += (queryLines.length * 4.5) + 6;
  }

  // Divider
  checkPageBreak(8);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos, margin + contentWidth, yPos);
  yPos += 8;

  // AI Recommendations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Performance Analysis & Recommendations:', margin, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  const rawText = typeof analysis === 'string'
    ? analysis
    : JSON.stringify(analysis, null, 2);

  const analysisLines = doc.splitTextToSize(rawText, contentWidth);

  analysisLines.forEach((line) => {
    checkPageBreak(5);
    doc.text(line, margin, yPos);
    yPos += 4.5;
  });

  doc.save(`Query_Performance_Report_${Date.now()}.pdf`);
};