/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Mock mode: check if Twilio credentials are available
const MOCK_MODE = !Deno.env.get("TWILIO_ACCOUNT_SID");
const ACC = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TOK = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const IS = Deno.env.get("TWILIO_CONVERSATIONS_SERVICE_SID") || "";
const SHARED_NUM = Deno.env.get("TWILIO_SHARED_NUMBER_E164") || "+15555555555";

const tw = (path:string, method:"GET"|"POST", body?:URLSearchParams) =>
  fetch(`https://conversations.twilio.com/v1/${path}`, {
    method, headers:{Authorization:"Basic "+btoa(`${ACC}:${TOK}`)}, body
  });

Deno.serve(async (req)=>{
  if (req.method !== "POST") return new Response("Method not allowed",{status:405});
  const { botId, members } = await req.json();
  if (!botId) return new Response("botId required", {status:400});

  // 1) Upsert members in DB
  if (Array.isArray(members) && members.length) {
    const rows = members.map((m:any)=>({bot_id:botId, display_name:m.display_name, phone_e164:m.phone_e164}));
    const up = await supabase.from("bot_members").upsert(rows, { onConflict: "bot_id,phone_e164" });
    if (up.error) return new Response(up.error.message, {status:400});
  }

  // 2) Add each as SMS participant to the Conversation
  const { data: bot } = await supabase.from("bots").select("conversation_sid").eq("id", botId).maybeSingle();
  if (!bot?.conversation_sid) return new Response("Conversation missing", {status:400});

  if (MOCK_MODE) {
    // Mock mode: just log what would happen
    console.log(`[MOCK MODE] Would add ${members?.length || 0} participants to conversation ${bot.conversation_sid}`);
    for (const m of (members||[])) {
      console.log(`[MOCK MODE]   - ${m.display_name} (${m.phone_e164})`);
    }
  } else {
    // Real mode: Add participants to Twilio
    for (const m of (members||[])) {
      const p = new URLSearchParams({
        "MessagingBinding.Address": m.phone_e164,
        "MessagingBinding.ProxyAddress": SHARED_NUM
      });
      const r = await tw(`Services/${IS}/Conversations/${bot.conversation_sid}/Participants`, "POST", p);
      // Ignore 409/50416 "already added" errors in practice
    }
  }

  return new Response(JSON.stringify({ ok:true }), {headers:{ "content-type":"application/json"}});
});
