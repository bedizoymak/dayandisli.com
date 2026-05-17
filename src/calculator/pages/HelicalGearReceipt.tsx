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
          <p className="text-slate-400 mb-4">Hesaplama sonucu bulunamadı.</p>
          <Link to={`/apps/calculator/machines/${machineId}/helical`}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Hesaplamaya Dön
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
    doc.text("Helisel Disli Üretim Reçetesi", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Makine: ${machine.name}`, 105, 30, { align: "center" });

    // Parameters table
    const paramData = [
      ["Modül (mn)", result.mn.toFixed(4)],
      ["Dis Sayisi (Z)", result.z.toString()],
      ["Kavrama Açisi (α)", `${result.alphaDeg.toFixed(2)}°`],
      ["Helis Açisi (β)", `${result.betaDeg.toFixed(2)}°`],
      ["Helis Yönü", result.helixDirection],
      ["Çap (ø)", `${result.diameter.toFixed(2)} mm`],
      [`Wk (k=${result.kFloor})`, `${result.wkFloor.toFixed(4)} mm`],
      [`Wk (k=${result.kCeil})`, `${result.wkCeil.toFixed(4)} mm`],
      ["Taksimat Orani", result.taksimatRatio.toFixed(6)],
      ["Helis Çark Orani", result.helicalGearRatio.toFixed(6)],
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
    doc.text("Taksimat Çark Kombinasyonlari", 105, lastY + 15, {
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
    doc.text("Helis Çark Kombinasyonlari", 105, lastY + 15, { align: "center" });

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
          Hesaplamaya Dön
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Helisel Dişli Üretim Reçetesi
            </h1>
            <p className="text-slate-400">{machine.name}</p>
          </div>
          <Button
            onClick={handleDownloadPDF}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF İndir
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
              <p className="text-xs text-slate-400">Modül (mn)</p>
              <p className="text-white font-mono">{result.mn.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Diş Sayısı (Z)</p>
              <p className="text-white font-mono">{result.z}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Kavrama Açısı (α)</p>
              <p className="text-white font-mono">{result.alphaDeg.toFixed(2)}°</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Helis Açısı (β)</p>
              <p className="text-white font-mono">{result.betaDeg.toFixed(2)}°</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Helis Yönü</p>
              <p className="text-white font-mono">{result.helixDirection}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Çap (ø)</p>
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
              <p className="text-xs text-slate-400">Taksimat Oranı</p>
              <p className="text-white font-mono">
                {result.taksimatRatio.toFixed(6)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Helis Çark Oranı</p>
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
            title="Taksimat Çark Kombinasyonları"
          />
          <GearCombinationsTable
            combinations={helicalCombinations}
            title="Helis Çark Kombinasyonları"
          />
        </div>
      </div>
    </CalculatorLayout>
  );
}
