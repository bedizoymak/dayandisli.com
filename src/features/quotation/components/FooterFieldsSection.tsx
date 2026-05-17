import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Calendar, Truck, CreditCard, MapPin, Settings } from "lucide-react";

interface FooterFieldsSectionProps {
  notlar: string;
  opsiyon: string;
  teslimSuresi: string;
  odemeSekli: string;
  teslimYeri: string;
  onNotlarChange: (value: string) => void;
  onOpsiyonChange: (value: string) => void;
  onTeslimSuresiChange: (value: string) => void;
  onOdemeSekliChange: (value: string) => void;
  onTeslimYeriChange: (value: string) => void;
}

export function FooterFieldsSection({
  notlar,
  opsiyon,
  teslimSuresi,
  odemeSekli,
  teslimYeri,
  onNotlarChange,
  onOpsiyonChange,
  onTeslimSuresiChange,
  onOdemeSekliChange,
  onTeslimYeriChange,
}: FooterFieldsSectionProps) {
  return (
    <Card className="mb-6 bg-slate-800/50 border-slate-700">
      <CardHeader className="border-b border-slate-700/50">
        <CardTitle className="text-white flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
            <Settings className="w-4 h-4 text-purple-400" />
          </div>
          Ek Bilgiler
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="notlar" className="text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Notlar
            </Label>
            <Textarea 
              id="notlar" 
              value={notlar} 
              onChange={(e) => onNotlarChange(e.target.value)} 
              placeholder="Ek notlar..."
              rows={3}
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opsiyon" className="text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Opsiyon
            </Label>
            <Input 
              id="opsiyon" 
              value={opsiyon} 
              onChange={(e) => onOpsiyonChange(e.target.value)} 
              placeholder="Opsiyon süresi"
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teslimSuresi" className="text-slate-300 flex items-center gap-2">
              <Truck className="w-4 h-4" /> Öngörülen Teslim Süresi
            </Label>
            <Input 
              id="teslimSuresi" 
              value={teslimSuresi} 
              onChange={(e) => onTeslimSuresiChange(e.target.value)} 
              placeholder="Örn: 15 iş günü"
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="odemeSekli" className="text-slate-300 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Ödeme Şekli
            </Label>
            <Input 
              id="odemeSekli" 
              value={odemeSekli} 
              onChange={(e) => onOdemeSekliChange(e.target.value)} 
              placeholder="Örn: %50 peşin, %50 teslimde"
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teslimYeri" className="text-slate-300 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Teslim Yeri
            </Label>
            <Input 
              id="teslimYeri" 
              value={teslimYeri} 
              onChange={(e) => onTeslimYeriChange(e.target.value)} 
              placeholder="Teslim adresi"
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

