/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const form = await req.formData();
  const from = String(form.get("From") || "");
  const body = String(form.get("Body") || "").trim().toUpperCase();
  if (!from) return new Response("", { status: 204 });

  if (["STOP","CANCEL","END","QUIT","UNSUBSCRIBE"].includes(body)) {
    await supabase.from("bot_members").update({ is_opted_in: false }).eq("phone_e164", from);
    return new Response("", { status: 200 });
  }
  if (["START","YES","UNSTOP"].includes(body)) {
    await supabase.from("bot_members").update({ is_opted_in: true }).eq("phone_e164", from);
    return new Response("", { status: 200 });
  }
  return new Response("", { status: 200 });
});
