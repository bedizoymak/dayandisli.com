import { supabase } from "./supabase";

export async function incrementCounter() {
  const { data, error } = await supabase.rpc("increment_counter", { 
    counter_key: "teklif"
  });

  if (error) {
    console.error("SUPABASE COUNTER ERROR:", error);
    return null;
  }

  return data; // RPC integer döndürür
}
