import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { CalculatorLayout } from "../components/CalculatorLayout";
import { ResultCard } from "../components/ResultCard";
import { getMachineById } from "../data/machines";
import {
  computeHelicalParams,
  validateHelicalInputs,
  HelicalGearResult,
  HelixDirection,
} from "../utils/gearHelical";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";

export default function HelicalGearForm() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const machine = getMachineById(machineId || "");

  const [mn, setMn] = useState<string>("1.0");
  const [z, setZ] = useState<string>("20");
  const [alphaDeg, setAlphaDeg] = useState<string>("20.0");
  const [betaDeg, setBetaDeg] = useState<string>("15.0");
  const [helixDirection, setHelixDirection] = useState<HelixDirection>("Sağ");
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<HelicalGearResult | null>(null);

  // Calculate results when inputs change
  useEffect(() => {
    const mnVal = parseFloat(mn);
    const zVal = parseInt(z);
    const alphaVal = parseFloat(alphaDeg);
    const betaVal = parseFloat(betaDeg);

    if (isNaN(mnVal) || isNaN(zVal) || isNaN(alphaVal) || isNaN(betaVal)) {
      setResult(null);
      return;
    }

    const validationErrors = validateHelicalInputs(mnVal, zVal, betaVal);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      const calculated = computeHelicalParams(
        mnVal,
        zVal,
        alphaVal,
        betaVal,
        helixDirection
      );
      setResult(calculated);
    } else {
      setResult(null);
    }
  }, [mn, z, alphaDeg, betaDeg, helixDirection]);

  const handleViewReceipt = () => {
    if (result) {
      navigate(`/apps/calculator/machines/${machineId}/helical/receipt`, {
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
          Helis Dişli Hesaplama
        </h1>
        <p className="text-slate-400 mb-8">
          Helical gear parametrelerini girin
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
                <Label htmlFor="beta" className="text-slate-300">
                  Helis Açısı (β) °
                </Label>
                <Input
                  id="beta"
                  type="number"
                  step="0.1"
                  min="0"
                  max="45"
                  value={betaDeg}
                  onChange={(e) => setBetaDeg(e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white"
                  placeholder="0 - 45"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direction" className="text-slate-300">
                  Helis Yönü
                </Label>
                <Select
                  value={helixDirection}
                  onValueChange={(v) => setHelixDirection(v as HelixDirection)}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sağ">Sağ</SelectItem>
                    <SelectItem value="Sol">Sol</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Calculated Diameter */}
              {result && (
                <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-600">
                  <p className="text-xs text-slate-400 mb-1">
                    Hesaplanan Çap (ø)
                  </p>
                  <p className="text-white font-mono text-lg">
                    {result.diameter.toFixed(2)} mm
                  </p>
                </div>
              )}

              {/* Errors */}
              {errors.length > 0 && (
                <div className="rounded-lg bg-red-900/20 border border-red-800 p-4">
                  {errors.map((error, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-red-400 text-sm"
                    >
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
                    <ResultCard
                      label="Kavrama Açısı (α)"
                      value={result.alphaDeg}
                      unit="°"
                    />
                    <ResultCard
                      label="Helis Açısı (β)"
                      value={result.betaDeg}
                      unit="°"
                    />
                    <ResultCard label="Helis Yönü" value={result.helixDirection} />
                    <ResultCard label="Çap (ø)" value={result.diameter} unit="mm" />
                    <ResultCard
                      label={`Wk (k=${result.kFloor})`}
                      value={result.wkFloor}
                      unit="mm"
                    />
                    <ResultCard
                      label={`Wk (k=${result.kCeil})`}
                      value={result.wkCeil}
                      unit="mm"
                    />
                    <ResultCard
                      label="Taksimat Oranı"
                      value={result.taksimatRatio}
                    />
                    <ResultCard
                      label="Helis Çark Oranı"
                      value={result.helicalGearRatio}
                    />
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
                className="w-full bg-purple-600 hover:bg-purple-700 h-12"
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
