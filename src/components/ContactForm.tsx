import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Send, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const ContactForm = () => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const recaptchaRef = useRef<HTMLDivElement>(null);

  // 🔥 WIDGET ID STATE
  const [widgetId, setWidgetId] = useState<number | null>(null);

  // 🔥 EXPLICIT RENDER + widgetId yakalama
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const interval = setInterval(() => {
      const grecaptcha = (window as any).grecaptcha;

      if (grecaptcha && recaptchaRef.current) {
        const id = grecaptcha.render(recaptchaRef.current, {
          sitekey: "6LcazR4sAAAAAC0F1pVHiW9c2dxh-H71U-MwBWQN",
        });

        setWidgetId(id);
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // Validation schema
  const formSchema = z.object({
    name: z.string().trim().min(2).max(50),
    email: z.string().trim().email(),
    phone: z.string().trim().min(10).max(20),
    company: z.string().trim().max(100).optional(),
    message: z.string().trim().min(10).max(1000),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      message: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured) {
        setIsSubmitting(false);
        return;
      }

      if (widgetId === null) {
        toast({
          title: "reCAPTCHA yüklenemedi",
          description: "Lütfen sayfayı yenileyin.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // 🔥 TOKEN DOĞRU INSTANCE'TAN ALINIYOR
      const token = (window as any).grecaptcha.getResponse(widgetId);

      if (!token) {
        toast({
          title: "reCAPTCHA doğrulanmadı",
          description: "Lütfen robot olmadığınızı doğrulayın.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/send-contact-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({
            ...values,
            token: token,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unknown error");
      }

      toast({
        title: t.contactForm.successTitle,
        description: t.contactForm.successDescription,
      });

      form.reset();
      (window as any).grecaptcha.reset(widgetId);
    } catch (err) {
      console.error("Contact form submission error:", err);
      toast({
        title: t.contactForm.errorTitle,
        description: t.contactForm.errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {!isSupabaseConfigured && (
          <div className="rounded-md border border-white/15 bg-white/10 p-4 text-sm font-medium text-white/80">
            İletişim formu şu anda yapılandırılıyor.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.contactForm.name}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t.contactForm.namePlaceholder}
                    className="bg-navy-lighter border-border"
                    disabled={!isSupabaseConfigured}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.contactForm.email}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t.contactForm.emailPlaceholder}
                    className="bg-navy-lighter border-border"
                    disabled={!isSupabaseConfigured}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.contactForm.phone}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t.contactForm.phonePlaceholder}
                    className="bg-navy-lighter border-border"
                    disabled={!isSupabaseConfigured}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.contactForm.company}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t.contactForm.companyPlaceholder}
                    className="bg-navy-lighter border-border"
                    disabled={!isSupabaseConfigured}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.contactForm.message}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t.contactForm.messagePlaceholder}
                  className="bg-navy-lighter border-border min-h-[120px]"
                  disabled={!isSupabaseConfigured}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ReCAPTCHA */}
        <div
  ref={recaptchaRef}
  className={isSupabaseConfigured ? "flex justify-center w-full" : "hidden"}
  style={{
    minHeight: "90px",
    paddingTop: "10px",
    paddingBottom: "10px",
  }}
></div>


        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          disabled={isSubmitting || !isSupabaseConfigured}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              {t.contactForm.sending}
            </>
          ) : (
            <>
              {t.contactForm.send}
              <Send className="ml-2 w-4 h-4" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};
