export function cleanEnvValue(value) {
  return String(value || "")
    .split(/\s+/)
    .map((part) => part.trim())
    .find(Boolean) || "";
}

export const supabaseUrl = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL);
export const supabaseAnonKey = cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
