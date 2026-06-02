// DAYAN CALCULATOR - Main exports and route configuration
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

const CalculatorDashboard = lazy(() => import("./pages/CalculatorDashboard"));
const MachineSelection = lazy(() => import("./pages/MachineSelection"));
const MachineDetail = lazy(() => import("./pages/MachineDetail"));
const SpurGearForm = lazy(() => import("./pages/SpurGearForm"));
const SpurGearReceipt = lazy(() => import("./pages/SpurGearReceipt"));
const HelicalGearForm = lazy(() => import("./pages/HelicalGearForm"));
const HelicalGearReceipt = lazy(() => import("./pages/HelicalGearReceipt"));
const WeightCalculation = lazy(() => import("./pages/WeightCalculation"));

export function CalculatorRoutes() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Hesaplama sayfası yükleniyor...</div>}>
    <Routes>
      <Route index element={<CalculatorDashboard />} />
      <Route path="machines" element={<MachineSelection />} />
      <Route path="machines/:machineId" element={<MachineDetail />} />
      <Route path="machines/:machineId/spur" element={<SpurGearForm />} />
      <Route path="machines/:machineId/spur/receipt" element={<SpurGearReceipt />} />
      <Route path="machines/:machineId/helical" element={<HelicalGearForm />} />
      <Route path="machines/:machineId/helical/receipt" element={<HelicalGearReceipt />} />
      <Route path="weight" element={<WeightCalculation />} />
    </Routes>
    </Suspense>
  );
}

export default CalculatorRoutes;
