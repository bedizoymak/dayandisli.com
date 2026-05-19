import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { getPublicLoginRedirectUrl } from "@/lib/domains";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [domainRedirecting, setDomainRedirecting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const redirectUrl = getPublicLoginRedirectUrl();
    if (!redirectUrl) return;

    setDomainRedirecting(true);
    window.location.replace(redirectUrl);
  }, []);

  const handleEmailLogin = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Giriş Hatası",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const userEmail = data.user?.email;
      if (!userEmail) {
        toast({
          title: "Giriş Başarısız",
          description: "Kullanıcı bilgisi alınamadı.",
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
          title: "Yetkisiz Giriş",
          description: "Bu e-posta sistemde yetkili değil.",
          variant: "destructive",
        });
        return;
      }

      const storedRedirectPath = localStorage.getItem("auth_redirect_path");
      const redirectPath =
        storedRedirectPath && !["/login", "/apps", "/"].includes(storedRedirectPath)
          ? storedRedirectPath
          : "/dashboard";
      localStorage.removeItem("auth_redirect_path");
      navigate(redirectPath, { replace: true });
    } catch {
      toast({
        title: "Hata",
        description: "Bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (domainRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-5 text-center shadow-xl">
          <p className="text-sm text-slate-300">ERP giriş alanına yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
        <div className="mb-8 flex justify-center">
          <img src="/logo-header.png" alt="Dayan Dişli Logo" className="h-16 object-contain" />
        </div>

        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Dayan Dişli ERP</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Giriş Yap</h1>
          <p className="mt-2 text-sm text-slate-500">Operasyon yönetim paneline erişim</p>
        </div>

        <div className="space-y-4">
          <Input type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <Button onClick={handleEmailLogin} disabled={loading} className="mt-4 h-12 w-full">
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </Button>

        <p className="mt-8 text-center text-sm text-slate-500">Sadece yetkili kullanıcılar giriş yapabilir.</p>
      </div>
    </div>
  );
}
