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
const IS = Deno.env.get("TWILIO_CONVERSATIONS_SERVICE_SID") || "";
const SHARED_NUM = Deno.env.get("TWILIO_SHARED_NUMBER_E164") || "+15555555555";

// Helper: Send individual SMS
async function sendIndividualSMS(toPhone: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACC}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${ACC}:${TOK}`),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: SHARED_NUM,
      To: toPhone,  // Single recipient
      Body: body,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to send SMS: ${errorText}`);
  }
  return res.json();
}

// Helper: Normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // US/Canada number (10 digits)
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Already has country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Already in E.164 format
  if (phone.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }

  // Invalid format
  console.warn(`Could not normalize phone number: ${phone}`);
  return null;
}

interface NotifyRequest {
  groupId: string;
  functionName: string;
  functionDetails?: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: NotifyRequest;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { groupId, functionName, functionDetails } = body;

  if (!groupId || !functionName) {
    return new Response("Missing required fields: groupId, functionName", {
      status: 400,
    });
  }

  // Fetch group details
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("name, user_id")
    .eq("id", groupId)
    .single();

  if (groupError || !group) {
    return new Response("Group not found", { status: 404 });
  }

  // Fetch group members (only accepted members)
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("name, phone_number")
    .eq("group_id", groupId)
    .eq("invitation_status", "accepted");

  if (membersError) {
    return new Response(membersError.message, { status: 400 });
  }

  if (!members || members.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, total: 0, message: "No members to notify" }),
      { headers: { "content-type": "application/json" } }
    );
  }

  // Normalize phone numbers
  const normalizedMembers = members
    .map((m) => ({
      name: m.name,
      phone: m.phone_number,
      phoneE164: normalizePhoneNumber(m.phone_number),
    }))
    .filter((m) => {
      if (!m.phoneE164) {
        console.warn(`Skipping member ${m.name} - invalid phone: ${m.phone}`);
        return false;
      }
      return true;
    });

  if (normalizedMembers.length === 0) {
    return new Response(
      JSON.stringify({
        sent: 0,
        total: members.length,
        message: "No valid phone numbers",
      }),
      { headers: { "content-type": "application/json" } }
    );
  }

  // Compose message
  const detailsText = functionDetails ? ` (${functionDetails})` : "";
  const messageBody = `Welcome to Textra!\n\nThe function "${functionName}"${detailsText} has been added to your group "${group.name}".\n\nYou'll now receive SMS updates from this group.`;

  // Send individual SMS to each member
  try {
    console.log(`=== TWILIO CONFIGURATION ===`);
    console.log(`MOCK_MODE: ${MOCK_MODE}`);
    console.log(`Account SID present: ${!!Deno.env.get("TWILIO_ACCOUNT_SID")}`);
    console.log(`Auth Token present: ${!!Deno.env.get("TWILIO_AUTH_TOKEN")}`);
    console.log(`Phone Number present: ${!!Deno.env.get("TWILIO_SHARED_NUMBER_E164")}`);
    console.log(`Normalized members: ${normalizedMembers.length}`);
    for (const m of normalizedMembers) {
      console.log(`  - ${m.name}: ${m.phoneE164}`);
    }

    const sentMessages = [];

    for (const member of normalizedMembers) {
      let messageSid = "";

      if (MOCK_MODE) {
        messageSid = `SM${crypto.randomUUID().replace(/-/g, "").substring(0, 32)}`;
        console.log(`[MOCK MODE] Would send to ${member.name} (${member.phoneE164})`);
      } else {
        const tw = await sendIndividualSMS(member.phoneE164, messageBody);
        messageSid = tw.sid;
        console.log(`Sent to ${member.name}: ${messageSid}`);
      }

      // Log each individual send
      await supabase.from("message_log").insert({
        bot_id: null,
        twilio_sid: messageSid,
        to_phone: member.phoneE164,
        status: "sent",
        body: messageBody,
      });

      sentMessages.push(messageSid);
    }

    return new Response(
      JSON.stringify({
        sent: normalizedMembers.length,
        total: members.length,
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending SMS notifications:", error);

    return new Response(
      JSON.stringify({
        sent: 0,
        total: members.length,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
});
