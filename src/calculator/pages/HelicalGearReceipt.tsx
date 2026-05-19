import { useLocation, useParams, Link, useNavigate } from "react-router-dom";
import { CalculatorLayout } from "../components/CalculatorLayout";
import { GearCombinationsTable } from "../components/GearCombinationsTable";
import { getMachineById } from "../data/machines";
import { HelicalGearResult } from "../utils/gearHelical";
import {
  findTaksimatCombinations,
  findHelicalCombinations,
} from "../utils/gearCombinations";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function HelicalGearReceipt() {
  const { machineId } = useParams<{ machineId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const machine = getMachineById(machineId || "");
  const result = location.state?.result as HelicalGearResult | undefined;

  if (!result || !machine) {
    return (
      <CalculatorLayout>
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">Hesaplama sonucu bulunamadÄ±.</p>
          <Link to={`/erp/calculator/machines/${machineId}/helical`}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Hesaplamaya DÃ¶n
            </Button>
          </Link>
        </div>
      </CalculatorLayout>
    );
  }

  const taksimatCombinations = findTaksimatCombinations(result.z);
  const helicalCombinations = findHelicalCombinations(result.helicalGearRatio);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Helisel Disli Ãœretim ReÃ§etesi", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Makine: ${machine.name}`, 105, 30, { align: "center" });

    // Parameters table
    const paramData = [
      ["ModÃ¼l (mn)", result.mn.toFixed(4)],
      ["Dis Sayisi (Z)", result.z.toString()],
      ["Kavrama AÃ§isi (Î±)", `${result.alphaDeg.toFixed(2)}Â°`],
      ["Helis AÃ§isi (Î²)", `${result.betaDeg.toFixed(2)}Â°`],
      ["Helis YÃ¶nÃ¼", result.helixDirection],
      ["Ã‡ap (Ã¸)", `${result.diameter.toFixed(2)} mm`],
      [`Wk (k=${result.kFloor})`, `${result.wkFloor.toFixed(4)} mm`],
      [`Wk (k=${result.kCeil})`, `${result.wkCeil.toFixed(4)} mm`],
      ["Taksimat Orani", result.taksimatRatio.toFixed(6)],
      ["Helis Ã‡ark Orani", result.helicalGearRatio.toFixed(6)],
    ];

    autoTable(doc, {
      startY: 40,
      head: [["Parametre", "Deger"]],
      body: paramData,
      theme: "grid",
      headStyles: { fillColor: [147, 51, 234] },
      styles: { halign: "center" },
    });

    // Taksimat combinations
    let lastY = (doc as any).lastAutoTable.finalY || 100;

    doc.setFontSize(14);
    doc.text("Taksimat Ã‡ark Kombinasyonlari", 105, lastY + 15, {
      align: "center",
    });

    const taksimatData = taksimatCombinations.map((c) => [
      c.a.toString(),
      c.b.toString(),
      c.c?.toString() || "-",
      c.d?.toString() || "-",
    ]);

    autoTable(doc, {
      startY: lastY + 20,
      head: [["A", "B", "C", "D"]],
      body: taksimatData.length > 0 ? taksimatData : [["-", "-", "-", "-"]],
      theme: "grid",
      headStyles: { fillColor: [147, 51, 234] },
      styles: { halign: "center" },
    });

    // Helical combinations
    lastY = (doc as any).lastAutoTable.finalY || 150;

    doc.setFontSize(14);
    doc.text("Helis Ã‡ark Kombinasyonlari", 105, lastY + 15, { align: "center" });

    const helicalData = helicalCombinations.map((c) => [
      c.a.toString(),
      c.b.toString(),
      c.c?.toString() || "-",
      c.d?.toString() || "-",
    ]);

    autoTable(doc, {
      startY: lastY + 20,
      head: [["A", "B", "C", "D"]],
      body: helicalData.length > 0 ? helicalData : [["-", "-", "-", "-"]],
      theme: "grid",
      headStyles: { fillColor: [147, 51, 234] },
      styles: { halign: "center" },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(10);
    doc.text("DAYAN CALCULATOR - Dayan Disli Sanayi", 105, pageHeight - 10, {
      align: "center",
    });

    doc.save(`helis-disli-recete-z${result.z}.pdf`);
  };

  return (
    <CalculatorLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Hesaplamaya DÃ¶n
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Helisel DiÅŸli Ãœretim ReÃ§etesi
            </h1>
            <p className="text-slate-400">{machine.name}</p>
          </div>
          <Button
            onClick={handleDownloadPDF}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF Ä°ndir
          </Button>
        </div>

        {/* Parameters Summary */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Parametreler</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-slate-400">ModÃ¼l (mn)</p>
              <p className="text-white font-mono">{result.mn.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">DiÅŸ SayÄ±sÄ± (Z)</p>
              <p className="text-white font-mono">{result.z}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Kavrama AÃ§Ä±sÄ± (Î±)</p>
              <p className="text-white font-mono">{result.alphaDeg.toFixed(2)}Â°</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Helis AÃ§Ä±sÄ± (Î²)</p>
              <p className="text-white font-mono">{result.betaDeg.toFixed(2)}Â°</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Helis YÃ¶nÃ¼</p>
              <p className="text-white font-mono">{result.helixDirection}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Ã‡ap (Ã¸)</p>
              <p className="text-white font-mono">{result.diameter.toFixed(2)} mm</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Wk (k={result.kFloor})</p>
              <p className="text-white font-mono">{result.wkFloor.toFixed(4)} mm</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Wk (k={result.kCeil})</p>
              <p className="text-white font-mono">{result.wkCeil.toFixed(4)} mm</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Taksimat OranÄ±</p>
              <p className="text-white font-mono">
                {result.taksimatRatio.toFixed(6)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Helis Ã‡ark OranÄ±</p>
              <p className="text-white font-mono">
                {result.helicalGearRatio.toFixed(6)}
              </p>
            </div>
          </div>
        </div>

        {/* Gear Combinations */}
        <div className="space-y-6">
          <GearCombinationsTable
            combinations={taksimatCombinations}
            title="Taksimat Ã‡ark KombinasyonlarÄ±"
          />
          <GearCombinationsTable
            combinations={helicalCombinations}
            title="Helis Ã‡ark KombinasyonlarÄ±"
          />
        </div>
      </div>
    </CalculatorLayout>
  );
}
