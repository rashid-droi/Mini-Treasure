"use client";

import { Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ReportExportButtons({ 
  event, 
  teams, 
  totalClues 
}: { 
  event: { id: string, name: string },
  teams: { name: string; score: number; bonusPoints: number; completionPercent: number; accuracy: number; wrongAttempts: number; hintsUsed: number; timeTaken: string }[],
  totalClues: number
}) {
  
  const handleExportCSV = () => {
    const headers = [
      "Rank", "Team Name", "Score", "Bonus Points", 
      "Completion %", "Accuracy %", "Mistakes", "Hints Used", "Time Taken"
    ];
    
    const rows = teams.map((team, idx) => [
      idx + 1,
      `"${team.name}"`,
      team.score,
      team.bonusPoints,
      `${team.completionPercent}%`,
      `${team.accuracy}%`,
      team.wrongAttempts,
      team.hintsUsed,
      `"${team.timeTaken}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${event.name.replace(/\s+/g, '_')}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.text("Event Report", 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(`Event: ${event.name}`, 14, 32);
    doc.text(`Total Clues: ${totalClues}`, 14, 40);

    const tableData = teams.map((team, idx) => [
      idx + 1,
      team.name,
      team.score.toString(),
      team.bonusPoints.toString(),
      `${team.completionPercent}%`,
      `${team.accuracy}%`,
      team.wrongAttempts.toString(),
      team.hintsUsed.toString(),
      team.timeTaken
    ]);

    autoTable(doc, {
      startY: 50,
      head: [["Rank", "Team", "Score", "Bonus", "Complete", "Accuracy", "Mistakes", "Hints", "Time"]],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [43, 43, 43] }, // #2b2b2b dark header
    });

    doc.save(`${event.name.replace(/\s+/g, '_')}_Report.pdf`);
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={handleExportCSV}
        className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-2 font-medium"
      >
        <Download className="w-4 h-4" />
        CSV
      </button>
      <button
        onClick={handleExportPDF}
        className="px-4 py-2 bg-[#f5c518]/15 text-[#c99a00] hover:bg-[#f5c518]/25 border border-[#f5c518]/40 rounded-lg transition-colors flex items-center gap-2 font-medium"
      >
        <FileText className="w-4 h-4" />
        PDF
      </button>
    </div>
  );
}
