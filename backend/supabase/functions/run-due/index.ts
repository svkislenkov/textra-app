/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const ACC = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TOK = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const SHARED_SVC = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID")!;

async function twilioSend(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACC}/Messages.json`;
  const form = new URLSearchParams({ To: to, MessagingServiceSid: SHARED_SVC, Body: body });
  const res = await fetch(url, { method: "POST", headers: { Authorization: "Basic " + btoa(`${ACC}:${TOK}`) }, body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { botId } = await req.json();
  if (!botId) return new Response("Missing botId", { status: 400 });

  const { data: bot } = await supabase.from("bots").select("*").eq("id", botId).maybeSingle();
  if (!bot) return new Response("Bot not found", { status: 404 });

  const { data: members } = await supabase
    .from("bot_members")
    .select("id, display_name, phone_e164, is_opted_in")
    .eq("bot_id", botId).eq("is_opted_in", true);

  const { data: chores } = await supabase
    .from("chores")
    .select("id, title")
    .eq("bot_id", botId);

  const { data: assigns } = await supabase
    .from("assignments")
    .select("id, member_id, chore_id, position_index")
    .eq("bot_id", botId)
    .order("position_index", { ascending: true });

  if (!members?.length || !chores?.length || !assigns?.length) {
    return new Response("Nothing to send", { status: 200 });
  }

  const membById = new Map(members.map(m => [m.id, m] as const));
  const choreById = new Map(chores.map(c => [c.id, c] as const));
  const mapping = assigns.map(a => ({ member: membById.get(a.member_id)!, chore: choreById.get(a.chore_id)! }));

  const header = `${bot.name} — Today’s chores:`;
  const lines = mapping.map(x => `• ${x.member.display_name} — ${x.chore.title}`);
  const body = `${header}\n${lines.join("\n")}\n\nReply STOP to opt out.`;

  let sentCount = 0;
  for (const m of members) {
    try {
      const tw = await twilioSend(m.phone_e164, body);
      await supabase.from("message_log").insert({
        bot_id: botId, twilio_sid: tw.sid, to_phone: m.phone_e164, status: tw.status, body
      });
      sentCount++;
    } catch (e) {
      await supabase.from("message_log").insert({
        bot_id: botId, to_phone: m.phone_e164, status: "error", body, error: String(e)
      });
    }
  }

  return new Response(JSON.stringify({ sent: sentCount }), { headers: { "content-type": "application/json" } });
});

