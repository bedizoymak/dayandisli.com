import { supabase } from "@/integrations/supabase/client";

export async function incrementCounter(): Promise<number | null> {
  const { data, error } = await supabase
    .from("counter" as never)
    .select("value")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("Counter read error:", error);
    return null;
  }

  const currentData = data as { value: number } | null;
  if (!currentData) return null;
  
  const newValue = currentData.value + 1;

  const { error: updateError } = await supabase
    .from("counter" as never)
    .update({ value: newValue } as never)
    .eq("id", 1);

  if (updateError) {
    console.error("Counter update error:", updateError);
    return null;
  }

  return newValue;
}
