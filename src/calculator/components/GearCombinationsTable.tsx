import { GearCombination } from "../utils/gearCombinations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GearCombinationsTableProps {
  combinations: GearCombination[];
  title: string;
}

export function GearCombinationsTable({ combinations, title }: GearCombinationsTableProps) {
  if (combinations.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <p className="text-slate-400 text-sm">Uygun kombinasyon bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-transparent">
            <TableHead className="text-slate-300 font-semibold">A</TableHead>
            <TableHead className="text-slate-300 font-semibold">B</TableHead>
            <TableHead className="text-slate-300 font-semibold">C</TableHead>
            <TableHead className="text-slate-300 font-semibold">D</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {combinations.map((combo, index) => (
            <TableRow key={index} className="border-slate-700 hover:bg-slate-700/30">
              <TableCell className="text-white font-mono">{combo.a}</TableCell>
              <TableCell className="text-white font-mono">{combo.b}</TableCell>
              <TableCell className="text-white font-mono">
                {combo.c ?? "-"}
              </TableCell>
              <TableCell className="text-white font-mono">
                {combo.d ?? "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
