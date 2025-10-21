/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Reuse twilioSend from run-due (copy for brevity)


Deno.serve(async (req) => {
if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
const { botId } = await req.json();
// load mapping (no rotation), compose body, send once.
// ... identical to run-due without index updates and last_sent_date.
return new Response("ok");
});