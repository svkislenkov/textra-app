/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Mock mode: check if Twilio credentials are available
const MOCK_MODE = !Deno.env.get("TWILIO_ACCOUNT_SID");
const ACC = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TOK = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

async function sendToConversation(conversationSid: string, body: string) {
  if (MOCK_MODE) {
    // Mock mode: just log the message that would be sent
    console.log(`[MOCK MODE] Would send to conversation ${conversationSid}:`);
    console.log(body);
    return { sid: `IM${crypto.randomUUID().replace(/-/g, '').substring(0, 32)}` };
  }

  // Real mode: Send to Twilio
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { botId } = await req.json();
  if (!botId) return new Response("Missing botId", { status: 400 });

  // Load bot (needs conversation_sid + name for header)
  const { data: bot, error: botErr } = await supabase
    .from("bots")
    .select("id, name, timezone, conversation_sid")
    .eq("id", botId)
    .maybeSingle();
  if (botErr) return new Response(botErr.message, { status: 400 });
  if (!bot) return new Response("Bot not found", { status: 404 });
  if (!bot.conversation_sid) return new Response("Conversation not set for this bot", { status: 400 });

  // Load mapping (members/chores/assignments) to compose today’s message
  const [{ data: members }, { data: chores }, { data: assigns }] = await Promise.all([
    supabase.from("bot_members")
      .select("id, display_name, is_opted_in")
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

  if (!members?.length || !chores?.length || !assigns?.length) {
    return new Response("Nothing to send", { status: 200 });
  }

  const membById = new Map(members.map(m => [m.id, m] as const));
  const choreById = new Map(chores.map(c => [c.id, c] as const));
  const mapping = assigns.map(a => ({ member: membById.get(a.member_id)!, chore: choreById.get(a.chore_id)! }));

  const header = `${bot.name} — Today’s chores:`;
  const lines = mapping.map(x => `• ${x.member.display_name} — ${x.chore.title}`);
  const body = `${header}\n${lines.join("\n")}\n\nReply STOP to opt out.`;

  // Post ONE message to the Conversation (Twilio fans it out to all participants)
  const tw = await sendToConversation(bot.conversation_sid, body);

  // Log once per bot send (conversation fan-out)
  await supabase.from("message_log").insert({
    bot_id: botId,
    twilio_sid: tw.sid,
    to_phone: `CONV:${bot.conversation_sid}`,
    status: "sent",
    body,
  });

  return new Response(JSON.stringify({ sent: 1 }), {
    headers: { "content-type": "application/json" },
  });
});
