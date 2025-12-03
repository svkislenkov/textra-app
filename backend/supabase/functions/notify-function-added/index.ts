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

// Helper: Twilio API request
const tw = (path: string, method: "GET" | "POST" | "DELETE", body?: URLSearchParams) =>
  fetch(`https://conversations.twilio.com/v1/${path}`, {
    method,
    headers: { Authorization: "Basic " + btoa(`${ACC}:${TOK}`) },
    body,
  });

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

  // Fetch group members
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("name, phone_number")
    .eq("group_id", groupId);

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

  let conversationSid = "";
  let messageSid = "";

  try {
    if (MOCK_MODE) {
      // Mock mode: Generate fake SIDs and log
      conversationSid = `CH${crypto.randomUUID().replace(/-/g, "").substring(0, 32)}`;
      messageSid = `IM${crypto.randomUUID().replace(/-/g, "").substring(0, 32)}`;

      console.log(`[MOCK MODE] Would create temporary conversation: ${conversationSid}`);
      console.log(
        `[MOCK MODE] Would add ${normalizedMembers.length} participants:`
      );
      for (const m of normalizedMembers) {
        console.log(`[MOCK MODE]   - ${m.name} (${m.phoneE164})`);
      }
      console.log(`[MOCK MODE] Would send message:`);
      console.log(messageBody);
      console.log(`[MOCK MODE] Would delete conversation: ${conversationSid}`);
    } else {
      // Real mode: Create temporary conversation
      const createRes = await tw(
        `Services/${IS}/Conversations`,
        "POST",
        new URLSearchParams({
          UniqueName: `temp-notify-${crypto.randomUUID()}`,
          "Timers.Closed": "PT1H", // Auto-close after 1 hour
        })
      );

      if (!createRes.ok) {
        throw new Error(
          `Failed to create conversation: ${await createRes.text()}`
        );
      }

      const convData = await createRes.json();
      conversationSid = convData.sid;

      // Add SMS participants
      for (const m of normalizedMembers) {
        const addRes = await tw(
          `Services/${IS}/Conversations/${conversationSid}/Participants`,
          "POST",
          new URLSearchParams({
            "MessagingBinding.Address": m.phoneE164,
            "MessagingBinding.ProxyAddress": SHARED_NUM,
          })
        );

        if (!addRes.ok) {
          const errorText = await addRes.text();
          // Log error but continue with other members
          console.error(
            `Failed to add participant ${m.name} (${m.phoneE164}): ${errorText}`
          );
        }
      }

      // Send message (fans out to all participants)
      const msgRes = await tw(
        `Conversations/${conversationSid}/Messages`,
        "POST",
        new URLSearchParams({ Body: messageBody })
      );

      if (!msgRes.ok) {
        throw new Error(`Failed to send message: ${await msgRes.text()}`);
      }

      const msgData = await msgRes.json();
      messageSid = msgData.sid;

      // Delete temporary conversation (cleanup)
      const delRes = await tw(`Conversations/${conversationSid}`, "DELETE");
      if (!delRes.ok) {
        // Log warning but don't fail
        console.warn(
          `Failed to delete temporary conversation ${conversationSid}: ${await delRes.text()}`
        );
      }
    }

    // Log to message_log
    await supabase.from("message_log").insert({
      bot_id: null, // Not associated with a bot
      twilio_sid: messageSid,
      to_phone: `TEMP_CONV:${conversationSid}`,
      status: "sent",
      body: messageBody,
    });

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
