/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Twilio Conversations API
const MOCK_MODE = !Deno.env.get("TWILIO_ACCOUNT_SID");
const ACC = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TOK = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

function toLocalHM(dateUTC: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit"
  }).formatToParts(dateUTC);
  const h = parts.find(p => p.type === "hour")?.value ?? "00";
  const m = parts.find(p => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}
function toLocalDateISO(dateUTC: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(dateUTC); // YYYY-MM-DD
}

async function sendToConversation(conversationSid: string, body: string) {
  if (MOCK_MODE) {
    console.log(`[MOCK MODE] Would send to conversation ${conversationSid}:`);
    console.log(body);
    return { sid: `IM${crypto.randomUUID().replace(/-/g, '').substring(0, 32)}` };
  }

  const url = `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${ACC}:${TOK}`),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ Body: body }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { sid: 'IM...', ... }
}

Deno.serve(async () => {
  const now = new Date();

  // Load active bots
  const { data: bots, error } = await supabase
    .from("bots")
    .select("id, name, timezone, schedule_time_local, last_sent_date, conversation_sid")
    .eq("is_active", true);
  if (error) return new Response(error.message, { status: 500 });

  const due = (bots ?? []).filter((b: any) =>
    toLocalHM(now, b.timezone) === b.schedule_time_local &&
    toLocalDateISO(now, b.timezone) !== String(b.last_sent_date || "")
  );

  const results: Array<{ botId: string; sent: boolean }> = [];

  for (const bot of due) {
    const botId = bot.id;

    // Skip bots without conversation_sid
    if (!bot.conversation_sid) {
      console.warn(`Bot ${botId} missing conversation_sid, skipping`);
      continue;
    }

    // Pull mapping
    const [{ data: members }, { data: chores }, { data: assigns }] = await Promise.all([
      supabase.from("bot_members")
        .select("id, display_name, phone_e164, is_opted_in")
        .eq("bot_id", botId)
        .eq("is_opted_in", true),
      supabase.from("chores")
        .select("id, title")
        .eq("bot_id", botId),
      supabase.from("assignments")
        .select("id, member_id, chore_id, position_index")
        .eq("bot_id", botId)
        .order("position_index", { ascending: true }),
    ]);

    if (!members?.length || !chores?.length || !assigns?.length) continue;

    const membById = new Map(members.map(m => [m.id, m] as const));
    const choreById = new Map(chores.map(c => [c.id, c] as const));
    const mapping = assigns.map(a => ({ member: membById.get(a.member_id)!, chore: choreById.get(a.chore_id)! }));

    const header = `${bot.name} — Today's chores:`;
    const lines = mapping.map(x => `• ${x.member.display_name} — ${x.chore.title}`);
    const body = `${header}\n${lines.join("\n")}\n\nReply STOP to opt out.`;

    // Send to Twilio Conversation (fans out to all participants)
    const tw = await sendToConversation(bot.conversation_sid, body);
    const twilioSid = tw.sid;

    // Log the conversation send
    await supabase.from("message_log").insert({
      bot_id: botId,
      twilio_sid: twilioSid,
      to_phone: `CONV:${bot.conversation_sid}`,
      status: "sent",
      body,
    });

    // Stamp last_sent_date (bot’s local day)
    await supabase
      .from("bots")
      .update({ last_sent_date: toLocalDateISO(now, bot.timezone) })
      .eq("id", botId);

    // Rotate indices modulo N
    const N = assigns.length;
    for (const a of assigns) {
      await supabase
        .from("assignments")
        .update({ position_index: (a.position_index + 1) % N })
        .eq("id", a.id);
    }

    results.push({ botId, sent: true });
  }

  return new Response(JSON.stringify({ ran: results }), {
    headers: { "content-type": "application/json" },
  });
});
