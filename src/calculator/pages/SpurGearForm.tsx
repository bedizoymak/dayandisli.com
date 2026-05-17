import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { CalculatorLayout } from "../components/CalculatorLayout";
import { ResultCard } from "../components/ResultCard";
import { getMachineById } from "../data/machines";
import { computeSpurParams, validateSpurInputs, SpurGearResult } from "../utils/gearSpur";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";

export default function SpurGearForm() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const machine = getMachineById(machineId || "");

  const [mn, setMn] = useState<string>("1.0");
  const [z, setZ] = useState<string>("20");
  const [alphaDeg, setAlphaDeg] = useState<string>("20.0");
  const [diameter, setDiameter] = useState<string>("");
  const [diameterOverride, setDiameterOverride] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<SpurGearResult | null>(null);

  // Auto-calculate diameter when mn or z changes
  useEffect(() => {
    if (!diameterOverride) {
      const mnVal = parseFloat(mn) || 0;
      const zVal = parseInt(z) || 0;
      const autoDiameter = (zVal + 2) * mnVal;
      setDiameter(autoDiameter.toFixed(2));
    }
  }, [mn, z, diameterOverride]);

  // Calculate results when inputs change
  useEffect(() => {
    const mnVal = parseFloat(mn);
    const zVal = parseInt(z);
    const alphaVal = parseFloat(alphaDeg);
    const diaVal = parseFloat(diameter);

    if (isNaN(mnVal) || isNaN(zVal) || isNaN(alphaVal) || isNaN(diaVal)) {
      setResult(null);
      return;
    }

    const validationErrors = validateSpurInputs(mnVal, zVal, diaVal);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      const calculated = computeSpurParams(mnVal, zVal, alphaVal, diaVal);
      setResult(calculated);
    } else {
      setResult(null);
    }
  }, [mn, z, alphaDeg, diameter]);

  const handleDiameterChange = (value: string) => {
    setDiameterOverride(true);
    setDiameter(value);
  };

  const handleViewReceipt = () => {
    if (result) {
      navigate(`/apps/calculator/machines/${machineId}/spur/receipt`, {
        state: { result },
      });
    }
  };

  if (!machine) {
    return (
      <CalculatorLayout>
        <div className="text-center py-12">
          <p className="text-slate-400">Makine bulunamadı.</p>
        </div>
      </CalculatorLayout>
    );
  }

  return (
    <CalculatorLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link
          to={`/apps/calculator/machines/${machineId}`}
          className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {machine.name}
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">
          Düz Dişli Hesaplama
        </h1>
        <p className="text-slate-400 mb-8">
          Spur gear parametrelerini girin
        </p>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Parametreler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="mn" className="text-slate-300">
                  Modül (mn)
                </Label>
                <Input
                  id="mn"
                  type="number"
                  step="0.1"
                  min="0.3"
                  max="3.0"
                  value={mn}
                  onChange={(e) => setMn(e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white"
                  placeholder="0.3 - 3.0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="z" className="text-slate-300">
                  Diş Sayısı (Z)
                </Label>
                <Input
                  id="z"
                  type="number"
                  step="1"
                  min="6"
                  value={z}
                  onChange={(e) => setZ(e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white"
                  placeholder="≥ 6"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alpha" className="text-slate-300">
                  Kavrama Açısı (α) °
                </Label>
                <Input
                  id="alpha"
                  type="number"
                  step="0.1"
                  value={alphaDeg}
                  onChange={(e) => setAlphaDeg(e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white"
                  placeholder="20.0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="diameter" className="text-slate-300">
                  Çap (ø) mm
                  {!diameterOverride && (
                    <span className="text-xs text-blue-400 ml-2">
                      (otomatik hesaplanan)
                    </span>
                  )}
                </Label>
                <Input
                  id="diameter"
                  type="number"
                  step="0.01"
                  value={diameter}
                  onChange={(e) => handleDiameterChange(e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white"
                  placeholder="8 - 250 mm"
                />
                {diameterOverride && (
                  <button
                    onClick={() => setDiameterOverride(false)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Otomatik hesaplamaya dön
                  </button>
                )}
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="rounded-lg bg-red-900/20 border border-red-800 p-4">
                  {errors.map((error, index) => (
                    <div key={index} className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Sonuçlar</CardTitle>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="grid grid-cols-2 gap-4">
                    <ResultCard label="Modül (mn)" value={result.mn} />
                    <ResultCard label="Diş Sayısı (Z)" value={result.z} />
                    <ResultCard label="Kavrama Açısı (α)" value={result.alphaDeg} unit="°" />
                    <ResultCard label="Çap (ø)" value={result.diameter} unit="mm" />
                    <ResultCard label={`Wk (k=${result.kFloor})`} value={result.wkFloor} unit="mm" />
                    <ResultCard label={`Wk (k=${result.kCeil})`} value={result.wkCeil} unit="mm" />
                    <ResultCard label="Taksimat Oranı" value={result.taksimatRatio} />
                    <ResultCard label="k değeri" value={result.k} />
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">
                    Geçerli parametreler girin
                  </p>
                )}
              </CardContent>
            </Card>

            {result && (
              <Button
                onClick={handleViewReceipt}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12"
              >
                Reçeteyi Görüntüle (PDF)
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </CalculatorLayout>
  );
}
