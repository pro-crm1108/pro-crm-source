import { createClient } from "@supabase/supabase-js";

/**
 * ПРО CRM · подключение к облаку Supabase
 * Ключ anon — публичный, защита данных обеспечивается RLS-политиками на стороне базы.
 */
const SUPABASE_URL = "https://ggvozozriouztsokxqhb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdndm96b3pyaW91enRzb2t4cWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MTgyOTcsImV4cCI6MjEwMjM5NDI5N30.Sfq_qBV6VFeXNi7nG-tFjrAFekMr5J1Fp_kBBzhdpww";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
