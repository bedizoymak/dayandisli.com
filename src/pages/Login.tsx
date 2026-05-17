import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleEmailLogin = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Giris Hatasi",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const userEmail = data.user?.email;
      if (!userEmail) {
        toast({
          title: "Giris Basarisiz",
          description: "Kullanici bilgisi alinamadi.",
          variant: "destructive",
        });
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users" as never)
        .select("email, is_active")
        .eq("email", userEmail)
        .eq("is_active", true)
        .maybeSingle();

      if (adminError || !adminUser) {
        await supabase.auth.signOut();
        toast({
          title: "Yetkisiz Giris",
          description: "Bu email sistemde yetkili degil.",
          variant: "destructive",
        });
        return;
      }

      const redirectPath = localStorage.getItem("auth_redirect_path") || "/apps";
      localStorage.removeItem("auth_redirect_path");
      navigate(redirectPath, { replace: true });
    } catch {
      toast({
        title: "Hata",
        description: "Bir hata olustu. Lutfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <div className="flex justify-center mb-8">
          <img src="/logo-header.png" alt="Dayan Disli Logo" className="h-16 object-contain" />
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-800 mb-8">Giris Yap</h1>

        <div className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Sifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button onClick={handleEmailLogin} disabled={loading} className="w-full h-12 mt-4">
          {loading ? "Giris yapiliyor..." : "Giris Yap"}
        </Button>

        <p className="mt-8 text-center text-sm text-slate-500">
          Sadece yetkili kullanicilar giris yapabilir.
        </p>
      </div>
    </div>
  );
}
