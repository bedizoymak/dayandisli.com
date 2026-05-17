import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, User, Phone, AtSign, FileText, Users } from "lucide-react";

interface CustomerInfoSectionProps {
  firma: string;
  ilgiliKisi: string;
  tel: string;
  email: string;
  konu: string;
  onFirmaChange: (value: string) => void;
  onIlgiliKisiChange: (value: string) => void;
  onTelChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onKonuChange: (value: string) => void;
  onCustomerSelectClick: () => void;
}

export function CustomerInfoSection({
  firma,
  ilgiliKisi,
  tel,
  email,
  konu,
  onFirmaChange,
  onIlgiliKisiChange,
  onTelChange,
  onEmailChange,
  onKonuChange,
  onCustomerSelectClick,
}: CustomerInfoSectionProps) {
  return (
    <Card className="mb-6 bg-slate-800/50 border-slate-700">
      <CardHeader className="border-b border-slate-700/50">
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            Müşteri Bilgileri
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onCustomerSelectClick}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <Users className="w-4 h-4 mr-2" />
            Müşteri Seç
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firma" className="text-slate-300 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Firma *
            </Label>
            <Input 
              id="firma" 
              value={firma} 
              onChange={(e) => onFirmaChange(e.target.value)} 
              placeholder="Firma adı"
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ilgili" className="text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4" /> İlgili Kişi *
            </Label>
            <Input 
              id="ilgili" 
              value={ilgiliKisi} 
              onChange={(e) => onIlgiliKisiChange(e.target.value)} 
              placeholder="Ad Soyad"
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tel" className="text-slate-300 flex items-center gap-2">
              <Phone className="w-4 h-4" /> Telefon
            </Label>
            <Input 
              id="tel" 
              value={tel} 
              onChange={(e) => onTelChange(e.target.value)} 
              placeholder="+90 XXX XXX XX XX"
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300 flex items-center gap-2">
              <AtSign className="w-4 h-4" /> E-posta *
            </Label>
            <Input 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => onEmailChange(e.target.value)} 
              placeholder="email@firma.com"
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="konu" className="text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Konu
            </Label>
            <Input 
              id="konu" 
              value={konu} 
              onChange={(e) => onKonuChange(e.target.value)} 
              placeholder="Teklif konusu"
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

