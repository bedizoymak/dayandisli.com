// DAYAN CALCULATOR - Main exports and route configuration
import { Routes, Route } from "react-router-dom";
import CalculatorDashboard from "./pages/CalculatorDashboard";
import MachineSelection from "./pages/MachineSelection";
import MachineDetail from "./pages/MachineDetail";
import SpurGearForm from "./pages/SpurGearForm";
import SpurGearReceipt from "./pages/SpurGearReceipt";
import HelicalGearForm from "./pages/HelicalGearForm";
import HelicalGearReceipt from "./pages/HelicalGearReceipt";
import WeightCalculation from "./pages/WeightCalculation";

export function CalculatorRoutes() {
  return (
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
  );
}

export default CalculatorRoutes;
