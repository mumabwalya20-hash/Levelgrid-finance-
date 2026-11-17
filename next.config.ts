import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (supabaseUrl || supabaseKey) {
  if (!supabaseUrl || !supabaseKey?.startsWith("sb_publishable_")) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and a Supabase publishable key.");
  }
  const origin = URL.canParse(supabaseUrl) ? new URL(supabaseUrl).origin : null;
  if (!origin?.startsWith("https://") || supabaseUrl.replace(/\/$/, "") !== origin) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS project origin.");
  }
}

const config: NextConfig = {
  output: "export",
};

export default config;
