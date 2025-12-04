/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Twilio (Programmable Messaging API for Group MMS)
const MOCK_MODE = !Deno.env.get("TWILIO_ACCOUNT_SID");
const ACC = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TOK = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const SHARED_NUM = Deno.env.get("TWILIO_SHARED_NUMBER_E164") || "+15555555555";

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

async function sendGroupMMS(toPhones: string[], body: string) {
  // Send MMS to multiple recipients (creates native group chat on phones)
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACC}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${ACC}:${TOK}`),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: SHARED_NUM,
      To: toPhones.join(","), // Multiple recipients = group MMS
      Body: body,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to send group MMS: ${errorText}`);
  }
  return res.json(); // { sid: 'MM...', ... }
}

Deno.serve(async () => {
  const now = new Date();

  // Load active bots
  const { data: bots, error } = await supabase
    .from("bots")
    .select("id, name, timezone, schedule_time_local, last_sent_date")
    .eq("is_active", true);
  if (error) return new Response(error.message, { status: 500 });

  const due = (bots ?? []).filter((b: any) =>
    toLocalHM(now, b.timezone) === b.schedule_time_local &&
    toLocalDateISO(now, b.timezone) !== String(b.last_sent_date || "")
  );

  const results: Array<{ botId: string; sent: boolean }> = [];

  for (const bot of due) {
    const botId = bot.id;

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

    // Collect phone numbers for group MMS
    const phoneNumbers = members
      .map(m => m.phone_e164)
      .filter(phone => phone); // Remove any null/undefined

    if (phoneNumbers.length === 0) {
      console.warn(`No valid phone numbers for bot ${botId}`);
      continue;
    }

    if (phoneNumbers.length > 10) {
      console.warn(`Bot ${botId} has ${phoneNumbers.length} members, exceeding MMS group limit of 10`);
      // You might want to split into multiple groups or handle differently
    }

    // Send group MMS to all members
    let twilioSid = "";
    if (MOCK_MODE) {
      twilioSid = `MM${crypto.randomUUID().replace(/-/g, "").substring(0, 32)}`;
      console.log(`[MOCK MODE] Would send group MMS to: ${phoneNumbers.join(", ")}`);
      console.log(`[MOCK MODE] Message: ${body}`);
    } else {
      const tw = await sendGroupMMS(phoneNumbers, body);
      twilioSid = tw.sid;
      console.log(`Sent group MMS to ${phoneNumbers.length} members: ${twilioSid}`);
    }

    // Log the group send
    await supabase.from("message_log").insert({
      bot_id: botId,
      twilio_sid: twilioSid,
      to_phone: `GROUP:${phoneNumbers.join(",")}`,
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
