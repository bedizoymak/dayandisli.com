import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Banknote, Package } from "lucide-react";
import { ProductRow, MALZEME_OPTIONS, BIRIM_OPTIONS, DOVIZ_OPTIONS } from "../types";

interface ProductTableSectionProps {
  products: ProductRow[];
  activeCurrency: string;
  onAddRow: () => void;
  onRemoveRow: (id: number) => void;
  onUpdateProduct: (id: number, field: keyof ProductRow, value: string | number) => void;
  onCurrencyChange: (currency: string) => void;
  calculateRowTotal: (row: ProductRow) => number;
  calculateSubtotal: () => number;
  calculateKDV: () => number;
  calculateTotal: () => number;
  formatCurrency: (amount: number, currency?: string) => string;
}

export function ProductTableSection({
  products,
  activeCurrency,
  onAddRow,
  onRemoveRow,
  onUpdateProduct,
  onCurrencyChange,
  calculateRowTotal,
  calculateSubtotal,
  calculateKDV,
  calculateTotal,
  formatCurrency,
}: ProductTableSectionProps) {
  return (
    <Card className="mb-6 bg-slate-800/50 border-slate-700">
      <CardHeader className="border-b border-slate-700/50">
        <CardTitle className="text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
              <Package className="w-4 h-4 text-emerald-400" />
            </div>
            Ürün / Hizmet Tablosu
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Global Currency Selector */}
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-slate-400" />
              <Select value={activeCurrency} onValueChange={onCurrencyChange}>
                <SelectTrigger className="w-28 h-9 bg-slate-900 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {DOVIZ_OPTIONS.map(m => (
                    <SelectItem key={m.value} value={m.value} className="text-white hover:bg-slate-700">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              size="sm" 
              onClick={onAddRow}
              className="bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-1" /> Satır Ekle
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-600">
              <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">#</th>
              <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Kod</th>
              <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Ürün/Hizmet</th>
              <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Malzeme</th>
              <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Miktar</th>
              <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Birim</th>
              <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Birim Fiyat ({DOVIZ_OPTIONS.find(d => d.value === activeCurrency)?.symbol})</th>
              <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Toplam</th>
              <th className="py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, idx) => (
              <tr key={product.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                <td className="py-3 px-2 text-center font-medium text-slate-400">{idx + 1}</td>
                <td className="py-3 px-2">
                  <Input 
                    value={product.kod} 
                    onChange={(e) => onUpdateProduct(product.id, 'kod', e.target.value)}
                    placeholder="Kod"
                    className="h-9 bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </td>
                <td className="py-3 px-2">
                  <Input 
                    value={product.cins} 
                    onChange={(e) => onUpdateProduct(product.id, 'cins', e.target.value)}
                    placeholder="Açıklama"
                    className="h-9 bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </td>
                <td className="py-3 px-2">
                  <Select value={product.malzeme} onValueChange={(v) => onUpdateProduct(product.id, 'malzeme', v)}>
                    <SelectTrigger className="h-9 bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {MALZEME_OPTIONS.map(m => (
                        <SelectItem key={m} value={m} className="text-white hover:bg-slate-700">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-3 px-2">
                  <Input 
                    type="number" 
                    min="1"
                    value={product.miktar} 
                    onChange={(e) => onUpdateProduct(product.id, 'miktar', parseInt(e.target.value) || 1)}
                    className="h-9 w-20 bg-slate-900 border-slate-600 text-white text-center"
                  />
                </td>
                <td className="py-3 px-2">
                  <Select value={product.birim} onValueChange={(v) => onUpdateProduct(product.id, 'birim', v)}>
                    <SelectTrigger className="h-9 w-24 bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {BIRIM_OPTIONS.map(b => (
                        <SelectItem key={b} value={b} className="text-white hover:bg-slate-700">{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-3 px-2">
                  <Input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={product.birimFiyat} 
                    onChange={(e) => onUpdateProduct(product.id, 'birimFiyat', parseFloat(e.target.value) || 0)}
                    className="h-9 w-28 bg-slate-900 border-slate-600 text-white text-right"
                  />
                </td>
                <td className="py-3 px-2 text-right">
                  <span className="font-semibold text-emerald-400 font-mono">
                    {formatCurrency(calculateRowTotal(product), activeCurrency)}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onRemoveRow(product.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    disabled={products.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-6">
          <div className="w-72 bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
            <div className="flex justify-between py-3 px-4 border-b border-slate-700">
              <span className="text-slate-400">Ara Toplam:</span>
              <span className="text-white font-mono">{formatCurrency(calculateSubtotal(), activeCurrency)}</span>
            </div>
            <div className="flex justify-between py-3 px-4 border-b border-slate-700">
              <span className="text-slate-400">KDV (%20):</span>
              <span className="text-white font-mono">{formatCurrency(calculateKDV(), activeCurrency)}</span>
            </div>
            <div className="flex justify-between py-3 px-4 bg-blue-600">
              <span className="font-bold text-white">Genel Toplam:</span>
              <span className="font-bold text-white font-mono">{formatCurrency(calculateTotal(), activeCurrency)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

