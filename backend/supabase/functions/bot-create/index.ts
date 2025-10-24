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

Deno.serve(async (req)=> {
  if (req.method !== "POST") return new Response("Method not allowed", {status:405});
  const { name, timezone, schedule_time_local, owner_user_id } = await req.json();

  let conversationSid = "";

  if (MOCK_MODE) {
    // Mock mode: generate fake conversation SID
    conversationSid = `CH${crypto.randomUUID().replace(/-/g, '').substring(0, 32)}`;
    console.log(`[MOCK MODE] Created fake conversation: ${conversationSid}`);
  } else {
    // Real mode: Create Conversation in your Service
    const form = new URLSearchParams({ FriendlyName: name });
    const convRes = await tw(`Services/${IS}/Conversations`, "POST", form);
    if (!convRes.ok) return new Response(await convRes.text(), {status:500});
    const conv = await convRes.json();
    conversationSid = conv.sid;
  }

  const { data, error } = await supabase.from("bots").insert({
    owner_user_id, name, timezone, schedule_time_local,
    twilio_number: SHARED_NUM,
    twilio_messaging_service_sid: null,
    conversation_sid: conversationSid,
    is_active: true
  }).select("*").single();

  if (error) return new Response(error.message, {status:400});
  return new Response(JSON.stringify(data), {headers:{ "content-type":"application/json"}});
});
