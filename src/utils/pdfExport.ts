import { jsPDF } from "jspdf";
import { Customer } from "../types";

export function exportCustomersToPDF(
  customers: Customer[],
  summaries: Record<string, string> = {},
  leadScores: Record<string, { rating: string; rationale: string }> = {},
  churnRisks: Record<string, { atRisk: boolean; rationale: string }> = {}
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2; // 180mm

  customers.forEach((customer, index) => {
    if (index > 0) {
      doc.addPage();
    }

    let y = 15;

    // --- PAGE HEADER BAND (Charcoal / Dark Theme aesthetic header) ---
    doc.setFillColor(18, 18, 20); // Deep dark gray
    doc.rect(marginX, y, contentWidth, 22, "F");

    // Corporate Gold Side strip
    doc.setFillColor(197, 160, 89); // Signature Gold (#C5A059)
    doc.rect(marginX, y, 3, 22, "F");

    // Header Typography
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text(customer.name.toUpperCase(), marginX + 6, y + 8);

    doc.setTextColor(197, 160, 89);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${customer.tier.toUpperCase()} MEMBER STATE // SYSTEM RECORD`, marginX + 6, y + 14);

    // Date/Rep Align Right
    doc.setTextColor(161, 161, 170);
    doc.setFontSize(8);
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`DATE: ${dateStr}`, pageWidth - marginX - 6, y + 8, { align: "right" });
    doc.text(`ASSIGNED REP: ${customer.assignedRep.toUpperCase()}`, pageWidth - marginX - 6, y + 14, { align: "right" });

    y += 28;

    // --- TWO COLUMN GRID: PROFILE vs PERFORMANCE ---
    // Col 1 X: 15mm, Col 2 X: 105mm. Both are 85mm wide
    const colWidth = 85;
    const colGap = 10;
    const col1X = marginX;
    const col2X = marginX + colWidth + colGap;

    const startY = y;

    // Col 1 BACKGROUND Box
    doc.setFillColor(248, 250, 252); // Very light grey surface
    doc.setDrawColor(226, 232, 240); // Soft grey border
    doc.rect(col1X, y, colWidth, 48, "FD");

    // Col 1 Section title
    doc.setFillColor(197, 160, 89);
    doc.rect(col1X + 3, y + 3, 2, 4, "F");
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ACCOUNT FIRMOGRAPHICS", col1X + 7, y + 6);

    // Profile Fields
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    
    doc.text("Company Name:", col1X + 7, y + 12);
    doc.text("Industry Segment:", col1X + 7, y + 18);
    doc.text("Global Region:", col1X + 7, y + 24);
    doc.text("Corporate Scale:", col1X + 7, y + 30);
    doc.text("Contact Role:", col1X + 7, y + 36);
    doc.text("Primary Contact:", col1X + 7, y + 42);

    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.text(customer.contact?.company || customer.name, col1X + 35, y + 12);
    doc.text(customer.account?.industry || "Enterprise Tech", col1X + 35, y + 18);
    doc.text(customer.account?.region || "North America", col1X + 35, y + 24);
    doc.text(customer.account?.size || "Enterprise", col1X + 35, y + 30);
    doc.text(customer.contact?.role || "VP Procurement", col1X + 35, y + 36);
    doc.text(customer.email, col1X + 35, y + 42);

    // Col 2 BACKGROUND Box
    doc.setFillColor(248, 250, 252);
    doc.rect(col2X, y, colWidth, 48, "FD");

    // Col 2 Section Title
    doc.setFillColor(197, 160, 89);
    doc.rect(col2X + 3, y + 3, 2, 4, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.text("PIPELINE PERFORMANCE METRICS", col2X + 7, y + 6);

    // KPI Values & Labels
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    
    doc.text("Lifetime Booked Value:", col2X + 7, y + 14);
    doc.text("System Lead Score:", col2X + 7, y + 22);
    doc.text("Deal Win Probability:", col2X + 7, y + 30);
    doc.text("Account Sentiment Status:", col2X + 7, y + 38);

    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`$${customer.lifetimeValue.toLocaleString()}`, col2X + 46, y + 14);
    doc.text(`${customer.leadScore} / 100`, col2X + 46, y + 22);
    doc.text(`${customer.winProbability}%`, col2X + 46, y + 30);

    // Sentiment Tag styled
    const sentiment = customer.sentiment || "Positive";
    if (sentiment === "Negative") {
      doc.setTextColor(220, 38, 38); // rich red
    } else if (sentiment === "Neutral") {
      doc.setTextColor(217, 119, 6); // amber-600
    } else {
      doc.setTextColor(5, 150, 105); // emerald-600
    }
    doc.text(`${sentiment.toUpperCase()}`, col2X + 46, y + 38);

    y += 54;

    // --- RECENT INTERACTION Touchpoints Timeline ---
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginX, y, contentWidth, 54, "D");

    // Title
    doc.setFillColor(15, 23, 42);
    doc.rect(marginX + 4, y + 4, 3, 4, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.text("RECENT TOUCHPOINTS & CUSTOMER ENGAGEMENT FEED", marginX + 9, y + 7.5);

    y += 13;

    if (customer.interactions && customer.interactions.length > 0) {
      customer.interactions.slice(0, 3).forEach((inter, idx) => {
        const itemY = y + idx * 12;

        // Draw connecting timeline dot
        doc.setFillColor(197, 160, 89);
        doc.circle(marginX + 7, itemY + 1.5, 1, "F");

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`${inter.channel.toUpperCase()} (${inter.agentOrBot})`, marginX + 11, itemY + 2.5);

        // Date align right
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Sentiment: ${inter.sentiment} // Days Ago: ${customer.lastInteractionDays}`, 
          pageWidth - marginX - 4, 
          itemY + 2.5, 
          { align: "right" }
        );

        // Details summary line
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85); // slate-700
        const shortSummary = inter.summary.length > 100 ? `${inter.summary.slice(0, 100)}...` : inter.summary;
        doc.text(shortSummary, marginX + 11, itemY + 6.5);
      });
    } else {
      doc.setFont("Helvetica", "oblique");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text("No touchpoint history recorded on the primary synchronization stream.", marginX + 10, y + 10);
    }

    y += 48;

    // --- GENERATIVE AI INTEL HUB & RISK AUDIT ---
    doc.setFillColor(18, 18, 20); // Pitch black backdrop
    doc.rect(marginX, y, contentWidth, 75, "F");

    // Signature top gold line
    doc.setFillColor(197, 160, 89);
    doc.rect(marginX, y, contentWidth, 1.5, "F");

    // Title text inside black box
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("CUSTOMER 360 COGNITIVE INTELLIGENCE REPORT", marginX + 6, y + 8);
    
    doc.setTextColor(197, 160, 89);
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.text("AUTONOMOUS COGNITIVE INSIGHTS POWERED BY GOOGLE GEMINI", marginX + 6, y + 13);

    y += 18;

    // Inside grid setup: AI Summary, Churn risk, and Lead rationale
    const aiColWidth = 53;
    const aiGap = 6;
    const aiCol1 = marginX + 5;
    const aiCol2 = aiCol1 + aiColWidth + aiGap;
    const aiCol3 = aiCol2 + aiColWidth + aiGap;

    // Content: Summary column
    const summaryText = summaries[customer.uid] || "AI Profile analysis idle. Click 'Refit' on the dashboard tab to dynamically compute.";
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("AI COGNITIVE SUMMARY", aiCol1, y);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(161, 161, 170); // slate-400
    
    // Split and write text lines
    const splitSummary = doc.splitTextToSize(summaryText, aiColWidth);
    doc.text(splitSummary, aiCol1, y + 4.5);

    // Content: Lead Score rationale
    const ratingObj = leadScores[customer.uid] || { rating: "AWAITING AUDIT", rationale: "Run interactive AI Lead Score analysis from the client panel." };
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("AI LEAD VALUATION", aiCol2, y);
    doc.setTextColor(197, 160, 89);
    doc.setFontSize(7.5);
    doc.text(`RATING: ${ratingObj.rating}`, aiCol2, y + 4.5);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(161, 161, 170);
    const splitScore = doc.splitTextToSize(ratingObj.rationale, aiColWidth);
    doc.text(splitScore, aiCol2, y + 9);

    // Content: Churn Risk sentinel
    const churnObj = churnRisks[customer.uid] || { atRisk: false, rationale: "Awaiting automatic pattern simulation triggers." };
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("CHURN RISK AUDIT", aiCol3, y);
    
    const churnStatusText = churnObj.atRisk || customer.dealRiskStatus === "At Risk" || customer.dealRiskStatus === "Escalated" || customer.sentiment === "Negative"
      ? "CRITICAL CHURN RISK DETECTED"
      : "STABLE ACCOUNT HEALTH";
    if (churnStatusText.startsWith("CRITICAL")) {
      doc.setTextColor(239, 68, 68);
    } else {
      doc.setTextColor(16, 185, 129);
    }
    doc.setFontSize(7.5);
    doc.text(churnStatusText, aiCol3, y + 4.5);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(161, 161, 170);
    const splitChurn = doc.splitTextToSize(churnObj.rationale || "Low probability signals detected across interaction vector streams.", aiColWidth);
    doc.text(splitChurn, aiCol3, y + 9);

    // --- FOOTER META STAMP ---
    doc.setFillColor(113, 113, 122);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);

    doc.setTextColor(113, 113, 122);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      `CONFIDENTIAL EXECUTIVE RECORD // SYSTEM IDENTIFIER: ID-${customer.uid.toUpperCase()}`, 
      marginX, 
      pageHeight - 9
    );
    doc.text(
      `REPORT PAGE ${index + 1} OF ${customers.length}`, 
      pageWidth - marginX, 
      pageHeight - 9, 
      { align: "right" }
    );
  });

  // Save the PDF doc
  const filename = customers.length === 1 
    ? `crm_360_executive_report_${customers[0].name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.pdf` 
    : `crm_bulk_executive_customer_reports_backup_${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(filename);
}
