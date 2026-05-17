import { useLocation, useParams, Link, useNavigate } from "react-router-dom";
import { CalculatorLayout } from "../components/CalculatorLayout";
import { GearCombinationsTable } from "../components/GearCombinationsTable";
import { getMachineById } from "../data/machines";
import { SpurGearResult } from "../utils/gearSpur";
import { findSpurCombinations } from "../utils/gearCombinations";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function SpurGearReceipt() {
  const { machineId } = useParams<{ machineId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const machine = getMachineById(machineId || "");
  const result = location.state?.result as SpurGearResult | undefined;

  if (!result || !machine) {
    return (
      <CalculatorLayout>
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">
            Hesaplama sonucu bulunamadı.
          </p>
          <Link to={`/apps/calculator/machines/${machineId}/spur`}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Hesaplamaya Dön
            </Button>
          </Link>
        </div>
      </CalculatorLayout>
    );
  }

  const combinations = findSpurCombinations(result.z);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Düz Disli Üretim Reçetesi", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Makine: ${machine.name}`, 105, 30, { align: "center" });

    // Parameters table
    const paramData = [
      ["Modül (mn)", result.mn.toFixed(4)],
      ["Dis Sayisi (Z)", result.z.toString()],
      ["Kavrama Açisi (α)", `${result.alphaDeg.toFixed(2)}°`],
      ["Çap (ø)", `${result.diameter.toFixed(2)} mm`],
      [`Wk (k=${result.kFloor})`, `${result.wkFloor.toFixed(4)} mm`],
      [`Wk (k=${result.kCeil})`, `${result.wkCeil.toFixed(4)} mm`],
      ["Taksimat Orani", result.taksimatRatio.toFixed(6)],
    ];

    autoTable(doc, {
      startY: 40,
      head: [["Parametre", "Deger"]],
      body: paramData,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      styles: { halign: "center" },
    });

    // Gear combinations table
    const lastY = (doc as any).lastAutoTable.finalY || 100;

    doc.setFontSize(14);
    doc.text("Taksimat Çark Kombinasyonlari", 105, lastY + 15, { align: "center" });

    const comboData = combinations.map((c) => [
      c.a.toString(),
      c.b.toString(),
      c.c?.toString() || "-",
      c.d?.toString() || "-",
    ]);

    autoTable(doc, {
      startY: lastY + 20,
      head: [["A", "B", "C", "D"]],
      body: comboData,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      styles: { halign: "center" },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(10);
    doc.text("DAYAN CALCULATOR - Dayan Disli Sanayi", 105, pageHeight - 10, {
      align: "center",
    });

    doc.save(`duz-disli-recete-z${result.z}.pdf`);
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
              Düz Dişli Üretim Reçetesi
            </h1>
            <p className="text-slate-400">{machine.name}</p>
          </div>
          <Button
            onClick={handleDownloadPDF}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF İndir
          </Button>
        </div>

        {/* Parameters Summary */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Parametreler</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <p className="text-white font-mono">{result.taksimatRatio.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">k değeri</p>
              <p className="text-white font-mono">{result.k.toFixed(4)}</p>
            </div>
          </div>
        </div>

        {/* Gear Combinations */}
        <GearCombinationsTable
          combinations={combinations}
          title="Taksimat Çark Kombinasyonları"
        />
      </div>
    </CalculatorLayout>
  );
}
