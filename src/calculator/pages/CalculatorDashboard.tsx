import { Link } from "react-router-dom";
import { CalculatorLayout } from "../components/CalculatorLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Scale, ArrowRight, Cog } from "lucide-react";

export default function CalculatorDashboard() {
  return (
    <CalculatorLayout>
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 mb-6 shadow-lg shadow-blue-500/25">
            <Cog className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            DAYAN CALCULATOR
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            DiÅŸli Ã¼retimi iÃ§in hesaplama ve ayar aracÄ±
          </p>
          <p className="text-slate-500 mt-4 max-w-xl mx-auto">
            Ã–nce makinenizi seÃ§in, sonra diÅŸli tipini ve parametreleri girerek
            Ã¼retim reÃ§etesi (PDF) oluÅŸturun.
          </p>
        </div>

        {/* Main Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-all group">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center mb-4 group-hover:bg-blue-600/30 transition-colors">
                <Settings className="w-6 h-6 text-blue-400" />
              </div>
              <CardTitle className="text-white text-xl">Makineler</CardTitle>
              <CardDescription className="text-slate-400">
                Makine seÃ§imi yaparak diÅŸli hesaplamalarÄ±na baÅŸlayÄ±n. DÃ¼z ve helis
                diÅŸli hesaplama modÃ¼lleri mevcuttur.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/erp/calculator/machines">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white group-hover:shadow-lg group-hover:shadow-blue-600/25 transition-all">
                  Makine SeÃ§imi
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-all group">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-emerald-600/20 flex items-center justify-center mb-4 group-hover:bg-emerald-600/30 transition-colors">
                <Scale className="w-6 h-6 text-emerald-400" />
              </div>
              <CardTitle className="text-white text-xl">AÄŸÄ±rlÄ±k Hesaplama</CardTitle>
              <CardDescription className="text-slate-400">
                Ham malzeme aÄŸÄ±rlÄ±ÄŸÄ±nÄ± hesaplayÄ±n. Silindirik parÃ§alar iÃ§in tahmini
                aÄŸÄ±rlÄ±k hesaplama aracÄ±.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/erp/calculator/weight">
                <Button 
                  variant="outline" 
                  className="w-full border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/20 hover:text-emerald-300 group-hover:shadow-lg group-hover:shadow-emerald-600/25 transition-all"
                >
                  Hesaplamaya Git
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Feature List */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "DÃ¼z DiÅŸli", desc: "Spur gear" },
            { label: "Helis DiÅŸli", desc: "Helical gear" },
            { label: "Taksimat", desc: "Division calc" },
            { label: "PDF Export", desc: "ReÃ§ete Ã§Ä±ktÄ±sÄ±" },
          ].map((feature) => (
            <div
              key={feature.label}
              className="text-center p-4 rounded-lg bg-slate-800/30 border border-slate-700/50"
            >
              <p className="text-white font-medium">{feature.label}</p>
              <p className="text-xs text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </CalculatorLayout>
  );
}
