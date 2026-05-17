import { Link } from "react-router-dom";
import { CalculatorLayout } from "../components/CalculatorLayout";
import { MACHINES } from "../data/machines";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, ChevronRight } from "lucide-react";

export default function MachineSelection() {
  return (
    <CalculatorLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Makine Seçimi</h1>
          <p className="text-slate-400">
            Hesaplama yapmak istediğiniz makineyi seçin
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {MACHINES.map((machine) => (
            <Card
              key={machine.id}
              className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-all group"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center group-hover:bg-blue-600/20 transition-colors">
                    <Settings className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
                <CardTitle className="text-white text-lg mt-3">
                  {machine.name}
                </CardTitle>
                <CardDescription className="text-slate-400 text-sm">
                  {machine.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to={`/apps/calculator/machines/${machine.id}`}>
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-slate-300 hover:text-white hover:bg-slate-700/50"
                  >
                    Seç
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </CalculatorLayout>
  );
}
