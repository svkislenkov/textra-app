/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SHARED_SVC = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID")!;
const SHARED_NUM = Deno.env.get("TWILIO_SHARED_NUMBER_E164") || "";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SHARED_SVC) return new Response("Missing TWILIO_MESSAGING_SERVICE_SID", { status: 500 });

  // For now pass owner_user_id in body; swap to Supabase auth later.
  const { name, timezone, schedule_time_local, owner_user_id } = await req.json();

  const { data, error } = await supabase
    .from("bots")
    .insert({
      owner_user_id, name, timezone, schedule_time_local,
      twilio_number: SHARED_NUM,
      twilio_messaging_service_sid: SHARED_SVC,
      is_active: true
    })
    .select("*")
    .single();

  if (error) return new Response(error.message, { status: 400 });
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
});
