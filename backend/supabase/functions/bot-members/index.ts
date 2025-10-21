/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type Member = { display_name: string; phone_e164: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { botId, members } = await req.json() as { botId: string; members: Member[] };
  if (!botId || !Array.isArray(members)) return new Response("botId + members[] required", { status: 400 });

  // Upsert by (bot_id, phone_e164). Add this unique index once in SQL:
  // CREATE UNIQUE INDEX IF NOT EXISTS uq_member_phone ON bot_members(bot_id, phone_e164);
  const rows = members.map(m => ({
    bot_id: botId,
    display_name: m.display_name,
    phone_e164: m.phone_e164,
  }));

  const { error } = await supabase
    .from("bot_members")
    .upsert(rows, { onConflict: "bot_id,phone_e164" });

  if (error) return new Response(error.message, { status: 400 });
  return new Response(JSON.stringify({ ok: true, count: rows.length }), { headers: { "content-type": "application/json" } });
});
