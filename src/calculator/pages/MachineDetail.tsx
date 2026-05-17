import { Link, useParams } from "react-router-dom";
import { CalculatorLayout } from "../components/CalculatorLayout";
import { getMachineById } from "../data/machines";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Cog, RotateCcw } from "lucide-react";

export default function MachineDetail() {
  const { machineId } = useParams<{ machineId: string }>();
  const machine = getMachineById(machineId || "");

  if (!machine) {
    return (
      <CalculatorLayout>
        <div className="text-center py-12">
          <p className="text-slate-400">Makine bulunamadı.</p>
          <Link to="/apps/calculator/machines">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Makine Listesine Dön
            </Button>
          </Link>
        </div>
      </CalculatorLayout>
    );
  }

  return (
    <CalculatorLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link
          to="/apps/calculator/machines"
          className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Makine Listesi
        </Link>

        {/* Machine Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <Cog className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{machine.name}</h1>
              <p className="text-slate-400 mt-1">{machine.description}</p>
            </div>
          </div>
        </div>

        {/* Operation Selection */}
        <h2 className="text-xl font-semibold text-white mb-4">
          İşlem Seçimi
        </h2>
        <p className="text-slate-400 mb-6">
          Hesaplamak istediğiniz dişli tipini seçin
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Spur Gear */}
          <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-all group">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center mb-2 group-hover:bg-blue-600/30 transition-colors">
                <Cog className="w-6 h-6 text-blue-400" />
              </div>
              <CardTitle className="text-white">Düz Dişli Hesaplama</CardTitle>
              <CardDescription className="text-slate-400">
                Spur gear - Düz dişli parametreleri ve Wk değerleri hesaplama
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={`/apps/calculator/machines/${machineId}/spur`}>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Hesaplamaya Başla
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Helical Gear */}
          <Card className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-all group">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex items-center justify-center mb-2 group-hover:bg-purple-600/30 transition-colors">
                <RotateCcw className="w-6 h-6 text-purple-400" />
              </div>
              <CardTitle className="text-white">Helis Dişli Hesaplama</CardTitle>
              <CardDescription className="text-slate-400">
                Helical gear - Helisel dişli parametreleri ve kombinasyon hesaplama
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={`/apps/calculator/machines/${machineId}/helical`}>
                <Button 
                  variant="outline"
                  className="w-full border-purple-600/50 text-purple-400 hover:bg-purple-600/20"
                >
                  Hesaplamaya Başla
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Future Placeholders */}
        <div className="mt-8 grid md:grid-cols-2 gap-4 opacity-50">
          {[
            { title: "Profil Taşlama", desc: "Yakında" },
            { title: "İç Dişli", desc: "Yakında" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4"
            >
              <p className="text-slate-400 font-medium">{item.title}</p>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </CalculatorLayout>
  );
}
