/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type Chore = { title: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { botId, chores } = await req.json() as { botId: string; chores: Chore[] };
  if (!botId || !Array.isArray(chores)) return new Response("botId + chores[] required", { status: 400 });

  // 1) Upsert chores by (bot_id, title). Add this unique index once in SQL:
  // CREATE UNIQUE INDEX IF NOT EXISTS uq_chore_title ON chores(bot_id, title);
  const choreRows = chores.map(c => ({ bot_id: botId, title: c.title }));
  const up = await supabase.from("chores").upsert(choreRows, { onConflict: "bot_id,title" }).select("id, title");
  if (up.error) return new Response(up.error.message, { status: 400 });

  // 2) Load members & chores to seed assignments (deterministic order)
  const [{ data: members, error: mErr }, { data: allChores, error: cErr }] = await Promise.all([
    supabase.from("bot_members").select("id, display_name").eq("bot_id", botId).order("display_name", { ascending: true }),
    supabase.from("chores").select("id, title").eq("bot_id", botId).order("title", { ascending: true })
  ]);
  if (mErr) return new Response(mErr.message, { status: 400 });
  if (cErr) return new Response(cErr.message, { status: 400 });
  if (!members?.length || !allChores?.length) return new Response("Need at least one member and one chore", { status: 400 });

  const N = Math.min(members.length, allChores.length);
  const pairs = Array.from({ length: N }, (_, i) => ({
    bot_id: botId,
    member_id: members[i].id,
    chore_id: allChores[i].id,
    position_index: i
  }));

  // 3) Replace existing assignments with new permutation
  const del = await supabase.from("assignments").delete().eq("bot_id", botId);
  if (del.error) return new Response(del.error.message, { status: 400 });

  const ins = await supabase.from("assignments").insert(pairs).select("id");
  if (ins.error) return new Response(ins.error.message, { status: 400 });

  return new Response(JSON.stringify({ ok: true, assignments: ins.data?.length || 0 }), {
    headers: { "content-type": "application/json" }
  });
});
