/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Twilio configuration
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

// Helper: Normalize phone number for comparison
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters and extract last 10 digits
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.slice(-10); // Take last 10 digits (removes country code if present)
}

// Helper: Send SMS via Twilio
async function sendSMS(to: string, body: string): Promise<{ sid: string; success: boolean; error?: string }> {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
      To: to,
      From: TWILIO_PHONE_NUMBER,
      Body: body,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Twilio error: ${errorText}`);
      return { sid: "", success: false, error: errorText };
    }

    const result = await response.json();
    return { sid: result.sid, success: true };
  } catch (error) {
    console.error(`Error sending SMS:`, error);
    return { sid: "", success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  try {
    // Parse incoming Twilio webhook (form-urlencoded)
    const formData = await req.formData();
    const from = formData.get("From") as string; // Sender's phone number (e.g., "+17345483475")
    const body = formData.get("Body") as string; // Message content
    const messageSid = formData.get("MessageSid") as string;

    console.log(`Incoming SMS from ${from}: ${body}`);

    // Ignore STOP/HELP commands (Twilio handles these automatically)
    if (!body || body.trim().toUpperCase().match(/^(STOP|START|HELP|UNSTOP)$/)) {
      console.log(`Ignoring command: ${body}`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Normalize the sender's phone number for comparison
    const normalizedFrom = normalizePhoneNumber(from);
    console.log(`Normalized sender phone: ${normalizedFrom}`);

    // Find the most recent message sent to this phone number (comparing normalized versions)
    const { data: allMessages } = await supabase
      .from("message_log")
      .select("group_id, to_phone, sent_at")
      .not("group_id", "is", null)
      .order("sent_at", { ascending: false });

    const recentMessage = allMessages?.find(msg =>
      normalizePhoneNumber(msg.to_phone) === normalizedFrom
    );

    if (!recentMessage || !recentMessage.group_id) {
      console.log(`No recent message found for ${from}, ignoring`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const groupId = recentMessage.group_id;
    console.log(`Replying to group: ${groupId}`);

    // Get all accepted members of this group
    const { data: allGroupMembers } = await supabase
      .from("group_members")
      .select("name, user_id, invitation_status, phone_number")
      .eq("group_id", groupId)
      .eq("invitation_status", "accepted");

    if (!allGroupMembers || allGroupMembers.length === 0) {
      console.log(`No accepted members found in group ${groupId}`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Find sender by comparing normalized phone numbers
    const sender = allGroupMembers.find(member =>
      normalizePhoneNumber(member.phone_number) === normalizedFrom
    );

    if (!sender) {
      console.log(`Sender ${from} is not an accepted member of group ${groupId}, ignoring`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { "Content-Type": "text/xml" },
      });
    }

    console.log(`Sender identified: ${sender.name}`);

    // Get all OTHER accepted members (exclude sender by comparing normalized phone numbers)
    const otherMembers = allGroupMembers.filter(member =>
      normalizePhoneNumber(member.phone_number) !== normalizedFrom
    );

    if (otherMembers.length === 0) {
      console.log(`No other members to relay to in group ${groupId}`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Format relay message
    const relayMessage = `${sender.name} said: ${body.trim()}`;
    console.log(`Relaying to ${otherMembers.length} members: ${relayMessage}`);

    // Send to all other members
    for (const member of otherMembers) {
      const smsResult = await sendSMS(member.phone_number, relayMessage);

      // Log the relay message
      await supabase.from("message_log").insert({
        bot_id: null, // Relay messages don't have a bot_id
        group_id: groupId,
        to_phone: member.phone_number,
        body: relayMessage,
        status: smsResult.success ? "sent" : "failed",
        twilio_sid: smsResult.sid,
        error: smsResult.error || null,
      });

      console.log(`Relayed to ${member.name} (${member.phone_number}): ${smsResult.success ? 'success' : 'failed'}`);
    }

    // Return empty TwiML response (no auto-reply to sender)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { "Content-Type": "text/xml" },
    });

  } catch (error) {
    console.error("Error processing incoming SMS:", error);
    // Return empty TwiML even on error to prevent Twilio retries
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { "Content-Type": "text/xml" },
    });
  }
});
