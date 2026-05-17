import { useState, useEffect } from "react";
import { CalculatorLayout } from "../components/CalculatorLayout";
import { MATERIAL_DENSITIES } from "../utils/weight";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale, Package, CircleDollarSign, Cylinder, CircleDot, RectangleHorizontal, Hash } from "lucide-react";

// Geometry types
const GEOMETRY_TYPES = {
  SOLID: "solid",
  PIPE: "pipe",
  FLAT: "flat",
} as const;

type GeometryType = typeof GEOMETRY_TYPES[keyof typeof GEOMETRY_TYPES];

const geometryOptions = [
  { value: GEOMETRY_TYPES.SOLID, label: "Silindir", icon: Cylinder },
  { value: GEOMETRY_TYPES.PIPE, label: "Boru", icon: CircleDot },
  { value: GEOMETRY_TYPES.FLAT, label: "Lama", icon: RectangleHorizontal },
];

const materialOptions = [
  { value: "steel", label: "Çelik", density: MATERIAL_DENSITIES.steel },
  { value: "stainlessSteel", label: "Paslanmaz Çelik", density: MATERIAL_DENSITIES.stainlessSteel },
  { value: "aluminum", label: "Alüminyum", density: MATERIAL_DENSITIES.aluminum },
  { value: "brass", label: "Pirinç", density: MATERIAL_DENSITIES.brass },
  { value: "bronze", label: "Bronz", density: MATERIAL_DENSITIES.bronze },
  { value: "copper", label: "Bakır", density: MATERIAL_DENSITIES.copper },
  { value: "cast_iron", label: "Dökme Demir", density: MATERIAL_DENSITIES.cast_iron },
  { value: "titanium", label: "Titanyum", density: MATERIAL_DENSITIES.titanium },
  { value: "custom", label: "Özel", density: 7.85 },
];

interface WeightResult {
  volumeMm3: number;
  volumeCm3: number;
  weightGrams: number;
  weightKg: number;
  totalWeightGrams: number;
  totalWeightKg: number;
}

export default function WeightCalculation() {
  // Geometry selection
  const [geometry, setGeometry] = useState<GeometryType>(GEOMETRY_TYPES.SOLID);
  
  // Solid cylinder inputs
  const [diameter, setDiameter] = useState<string>("50");
  const [length, setLength] = useState<string>("100");
  
  // Pipe inputs
  const [outerDiameter, setOuterDiameter] = useState<string>("60");
  const [innerDiameter, setInnerDiameter] = useState<string>("40");
  
  // Flat bar inputs
  const [width, setWidth] = useState<string>("50");
  const [height, setHeight] = useState<string>("10");
  
  // Material
  const [material, setMaterial] = useState<string>("steel");
  const [customDensity, setCustomDensity] = useState<string>("7.85");
  
  // Price
  const [pricePerKg, setPricePerKg] = useState<string>("");
  
  // Quantity
  const [quantity, setQuantity] = useState<string>("1");
  
  // Result
  const [result, setResult] = useState<WeightResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Calculate volume based on geometry
  const calculateVolume = (geo: GeometryType): number | null => {
    switch (geo) {
      case GEOMETRY_TYPES.SOLID: {
        const d = parseFloat(diameter);
        const l = parseFloat(length);
        if (isNaN(d) || isNaN(l) || d <= 0 || l <= 0) return null;
        return Math.PI * Math.pow(d / 2, 2) * l;
      }
      case GEOMETRY_TYPES.PIPE: {
        const od = parseFloat(outerDiameter);
        const id = parseFloat(innerDiameter);
        const l = parseFloat(length);
        if (isNaN(od) || isNaN(id) || isNaN(l) || od <= 0 || id <= 0 || l <= 0) return null;
        if (od <= id) {
          setValidationError("Dış çap, iç çaptan büyük olmalıdır");
          return null;
        }
        return (Math.PI / 4) * (Math.pow(od, 2) - Math.pow(id, 2)) * l;
      }
      case GEOMETRY_TYPES.FLAT: {
        const w = parseFloat(width);
        const h = parseFloat(height);
        const l = parseFloat(length);
        if (isNaN(w) || isNaN(h) || isNaN(l) || w <= 0 || h <= 0 || l <= 0) return null;
        return w * h * l;
      }
      default:
        return null;
    }
  };

  useEffect(() => {
    setValidationError(null);
    
    const selectedMaterial = materialOptions.find((m) => m.value === material);
    const density =
      material === "custom"
        ? parseFloat(customDensity)
        : selectedMaterial?.density || 7.85;

    if (isNaN(density) || density <= 0) {
      setResult(null);
      return;
    }

    const volumeMm3 = calculateVolume(geometry);
    
    if (volumeMm3 === null) {
      setResult(null);
      return;
    }

    const quantityValue = Math.max(1, parseInt(quantity) || 1);

    const volumeCm3 = volumeMm3 / 1000;
    const weightGrams = volumeCm3 * density;
    const weightKg = weightGrams / 1000;
    const totalWeightGrams = weightGrams * quantityValue;
    const totalWeightKg = weightKg * quantityValue;

    setResult({
      volumeMm3,
      volumeCm3,
      weightGrams,
      weightKg,
      totalWeightGrams,
      totalWeightKg,
    });
  }, [geometry, diameter, length, outerDiameter, innerDiameter, width, height, material, customDensity, quantity]);

  const currentDensity =
    material === "custom"
      ? parseFloat(customDensity) || 0
      : materialOptions.find((m) => m.value === material)?.density || 7.85;

  const priceValue = parseFloat(pricePerKg);
  const quantityValue = Math.max(1, parseInt(quantity) || 1);
  const showCost = result && !isNaN(priceValue) && priceValue > 0;
  const singleCost = showCost ? result.weightKg * priceValue : 0;
  const totalCost = showCost ? singleCost * quantityValue : 0;

  const getFormulaText = () => {
    switch (geometry) {
      case GEOMETRY_TYPES.SOLID:
        return "Hacim = π × (çap/2)² × uzunluk";
      case GEOMETRY_TYPES.PIPE:
        return "Hacim = (π/4) × (D_dış² - D_iç²) × uzunluk";
      case GEOMETRY_TYPES.FLAT:
        return "Hacim = genişlik × yükseklik × uzunluk";
    }
  };

  return (
    <CalculatorLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Ağırlık Hesaplama</h1>
          </div>
          <p className="text-slate-400">
            Farklı geometriler için tahmini ağırlık ve maliyet hesaplama
          </p>
        </div>

        <div className="grid gap-6">
          {/* Input Form */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Parametreler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Geometry Selection */}
              <div className="space-y-2">
                <Label htmlFor="geometry" className="text-slate-300">
                  Geometri Tipi
                </Label>
                <Select value={geometry} onValueChange={(v) => setGeometry(v as GeometryType)}>
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-600">
                    {geometryOptions.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-slate-800">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-emerald-400" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Inputs Based on Geometry */}
              {geometry === GEOMETRY_TYPES.SOLID && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="diameter" className="text-slate-300">
                      Çap (mm)
                    </Label>
                    <Input
                      id="diameter"
                      type="number"
                      step="0.1"
                      min="0"
                      value={diameter}
                      onChange={(e) => setDiameter(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                      placeholder="50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="length" className="text-slate-300">
                      Uzunluk (mm)
                    </Label>
                    <Input
                      id="length"
                      type="number"
                      step="0.1"
                      min="0"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                      placeholder="100"
                    />
                  </div>
                </div>
              )}

              {geometry === GEOMETRY_TYPES.PIPE && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="outerDiameter" className="text-slate-300">
                      Dış Çap (mm)
                    </Label>
                    <Input
                      id="outerDiameter"
                      type="number"
                      step="0.1"
                      min="0"
                      value={outerDiameter}
                      onChange={(e) => setOuterDiameter(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                      placeholder="60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="innerDiameter" className="text-slate-300">
                      İç Çap (mm)
                    </Label>
                    <Input
                      id="innerDiameter"
                      type="number"
                      step="0.1"
                      min="0"
                      value={innerDiameter}
                      onChange={(e) => setInnerDiameter(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                      placeholder="40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pipeLength" className="text-slate-300">
                      Uzunluk (mm)
                    </Label>
                    <Input
                      id="pipeLength"
                      type="number"
                      step="0.1"
                      min="0"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                      placeholder="100"
                    />
                  </div>
                </div>
              )}

              {geometry === GEOMETRY_TYPES.FLAT && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="width" className="text-slate-300">
                      Genişlik (mm)
                    </Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.1"
                      min="0"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                      placeholder="50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height" className="text-slate-300">
                      Yükseklik (mm)
                    </Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.1"
                      min="0"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flatLength" className="text-slate-300">
                      Uzunluk (mm)
                    </Label>
                    <Input
                      id="flatLength"
                      type="number"
                      step="0.1"
                      min="0"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                      placeholder="100"
                    />
                  </div>
                </div>
              )}

              {/* Material Selection */}
              <div className="space-y-2">
                <Label htmlFor="material" className="text-slate-300">
                  Malzeme
                </Label>
                <Select value={material} onValueChange={setMaterial}>
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-600">
                    {materialOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-slate-800">
                        {opt.label} ({opt.density} g/cm³)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {material === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="customDensity" className="text-slate-300">
                    Özel Yoğunluk (g/cm³)
                  </Label>
                  <Input
                    id="customDensity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={customDensity}
                    onChange={(e) => setCustomDensity(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                    placeholder="7.85"
                  />
                </div>
              )}

              {/* Price Per Kg and Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pricePerKg" className="text-slate-300">
                    Malzeme Fiyatı (TL/kg)
                  </Label>
                  <Input
                    id="pricePerKg"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                    placeholder="Opsiyonel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-slate-300 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    Adet
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="1"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Current Density Display */}
              <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-600">
                <p className="text-xs text-slate-400 mb-1">Kullanılan Yoğunluk</p>
                <p className="text-white font-mono">{currentDensity.toFixed(2)} g/cm³</p>
              </div>
            </CardContent>
          </Card>

          {/* Result */}
<Card className="bg-gradient-to-br from-emerald-900/30 to-slate-800/50 border-emerald-700/50">
  <CardHeader>
    <CardTitle className="text-white flex items-center gap-2">
      <Package className="w-5 h-5 text-emerald-400" />
      Ağırlık
    </CardTitle>
  </CardHeader>
  <CardContent>
    {validationError ? (
      <p className="text-red-400 text-center py-8">{validationError}</p>
    ) : result ? (
      <div className="text-center py-4">
        {/* Single Item Weight */}
        <p className="text-sm text-slate-400 mb-2">Birim Ağırlık</p>
        <p className="text-3xl font-bold text-white mb-1">
          {result.weightKg.toFixed(2)}
          <span className="text-xl text-slate-400 ml-2">kg</span>
        </p>
        <p className="text-sm text-slate-500 mb-4">
          ({result.weightGrams.toFixed(1)} gram)
        </p>

        {/* Total Weight - only show if quantity > 1 */}
        {quantityValue > 1 && (
          <>
            <div className="border-t border-slate-700/50 my-4" />
            <p className="text-sm text-emerald-400 mb-2">
              Toplam Ağırlık ({quantityValue} Adet)
            </p>
            <p className="text-4xl font-bold text-white mb-1">
              {result.totalWeightKg.toFixed(2)}
              <span className="text-xl text-slate-400 ml-2">kg</span>
            </p>
            <p className="text-sm text-slate-500">
              ({result.totalWeightGrams.toFixed(1)} gram)
            </p>
          </>
        )}
      </div>
    ) : (
      <p className="text-slate-400 text-center py-8">
        Geçerli parametreler girin
      </p>
    )}
  </CardContent>
</Card>


          {/* Cost Card */}
{showCost && (
  <Card className="bg-gradient-to-br from-amber-900/30 to-slate-800/50 border-amber-700/50">
    <CardHeader>
      <CardTitle className="text-white flex items-center gap-2">
        <CircleDollarSign className="w-5 h-5 text-amber-400" />
        Maliyet
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-center py-6">

        {/* Birim Maliyet */}
        <p className="text-sm text-slate-400 mb-2">Birim Maliyet</p>
        <p className="text-2xl font-semibold text-white mb-4">
          {singleCost.toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          TL / adet
        </p>

        <div className="border-t border-slate-700/50 my-4" />

        {/* Toplam Maliyet */}
        <p className="text-sm text-emerald-400 mb-2">
          Toplam Maliyet ({quantityValue} adet)
        </p>
        <p className="text-4xl font-bold text-white mb-1">
          {totalCost.toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          <span className="text-2xl text-slate-400 ml-2">TL</span>
        </p>

        {/* Ayrıntılı Formül Kırılımı */}
        <p className="text-sm text-slate-500">
          ({result!.weightKg.toFixed(2)} kg × {priceValue.toFixed(2)} TL/kg
          {quantityValue > 1 ? ` × ${quantityValue} adet` : ""})
        </p>
      </div>
    </CardContent>
  </Card>
)}



          {/* Formula Info */}
          <div className="text-sm text-slate-500 text-center space-y-1">
            <p>Formül: {getFormulaText()}</p>
            <p>Ağırlık = Hacim × Yoğunluk</p>
          </div>
        </div>
      </div>
    </CalculatorLayout>
  );
}
