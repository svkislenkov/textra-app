/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Twilio configuration
const MOCK_MODE = !Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const TIMEZONE = "America/New_York";

// Helper: Get current time in HH:MM format in Eastern Time
function getCurrentTimeET(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find(p => p.type === "hour")?.value || "00";
  const minute = parts.find(p => p.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}

// Helper: Get current date in YYYY-MM-DD format in Eastern Time
function getCurrentDateET(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

// Helper: Get current day of week (0=Sunday, 6=Saturday) in Eastern Time
function getCurrentDayOfWeekET(): number {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long"
  }).format(now);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days.indexOf(dateStr);
}

// Helper: Get current day of month in Eastern Time
function getCurrentDayOfMonthET(): number {
  const now = new Date();
  const dayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    day: "numeric"
  }).format(now);
  return parseInt(dayStr, 10);
}

// Helper: Send SMS via Twilio
async function sendSMS(to: string, body: string): Promise<{ sid: string; success: boolean; error?: string }> {
  if (MOCK_MODE) {
    console.log(`[MOCK MODE] SMS to ${to}: ${body}`);
    return { sid: `SM${crypto.randomUUID().replace(/-/g, '').substring(0, 32)}`, success: true };
  }

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

// Helper: Replace template variables in message
function replaceTemplateVars(template: string, name: string, task: string): string {
  return template
    .replace(/{name}/g, name)
    .replace(/{task}/g, task);
}

// Helper: Get task description from bot
function getTaskDescription(bot: any): string {
  // If custom type with message_template, use that
  if (bot.type === "Custom Type" && bot.message_template) {
    return bot.message_template;
  }
  // Otherwise use the type
  return bot.type || "Complete task";
}

Deno.serve(async () => {
  try {
    const currentTime = getCurrentTimeET();
    const currentDate = getCurrentDateET();
    const currentDayOfWeek = getCurrentDayOfWeekET();
    const currentDayOfMonth = getCurrentDayOfMonthET();

    console.log(`Running at ${currentTime} ET on ${currentDate}`);

    // Fetch all active bots
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("*")
      .eq("is_active", true);

    if (botsError) {
      console.error("Error fetching bots:", botsError);
      return new Response(JSON.stringify({ error: botsError.message }), { status: 500 });
    }

    if (!bots || bots.length === 0) {
      return new Response(JSON.stringify({ message: "No active bots found", processed: [] }), { status: 200 });
    }

    // Filter bots that are due to run
    const dueBots = bots.filter(bot => {
      // Skip if already run today
      if (bot.last_sent_date === currentDate) {
        return false;
      }

      // Parse bot time (stored as UTC ISO string, convert to Eastern Time)
      const botTime = new Date(bot.time);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(botTime);
      const botHour = parts.find(p => p.type === "hour")?.value || "00";
      const botMinute = parts.find(p => p.type === "minute")?.value || "00";
      const botTimeStr = `${botHour}:${botMinute}`;

      // Check if time matches
      if (botTimeStr !== currentTime) {
        return false;
      }

      // Check frequency
      if (bot.frequency === "Daily") {
        return true;
      } else if (bot.frequency === "Weekly") {
        // Map day_of_week string to number
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const botDayOfWeek = days.indexOf(bot.day_of_week);
        return botDayOfWeek === currentDayOfWeek;
      } else if (bot.frequency === "Monthly") {
        return bot.day_of_month === currentDayOfMonth;
      }

      return false;
    });

    console.log(`Found ${dueBots.length} bots due to run`);

    const results = [];

    // Process each due bot
    for (const bot of dueBots) {
      console.log(`Processing bot: ${bot.name} (${bot.id})`);

      // Get all groups this bot is assigned to
      const { data: botGroups, error: botGroupsError } = await supabase
        .from("bot_groups")
        .select(`
          *,
          groups (
            id,
            name
          )
        `)
        .eq("bot_id", bot.id);

      if (botGroupsError) {
        console.error(`Error fetching groups for bot ${bot.id}:`, botGroupsError);
        continue;
      }

      if (!botGroups || botGroups.length === 0) {
        console.log(`Bot ${bot.name} has no assigned groups, skipping`);
        continue;
      }

      // Process each group
      for (const botGroup of botGroups) {
        const groupId = botGroup.group_id;
        console.log(`Processing group: ${botGroup.groups.name} (${groupId})`);

        // Get accepted members of this group
        const { data: members, error: membersError } = await supabase
          .from("group_members")
          .select("*")
          .eq("group_id", groupId)
          .eq("invitation_status", "accepted")
          .order("name");

        if (membersError) {
          console.error(`Error fetching members for group ${groupId}:`, membersError);
          continue;
        }

        if (!members || members.length === 0) {
          console.log(`Group ${groupId} has no accepted members, skipping`);
          continue;
        }

        // Determine who is assigned this time (rotation logic)
        const currentIndex = botGroup.current_member_index || 0;
        const assignedMember = members[currentIndex % members.length];
        const nextIndex = (currentIndex + 1) % members.length;

        console.log(`Assigned member: ${assignedMember.name} (index ${currentIndex})`);

        // Build message
        const taskDescription = getTaskDescription(bot);
        const assignedName = assignedMember.name;

        // Message format: "Task - Person's turn"
        // Support template variables if message_template exists
        let message: string;
        if (bot.type === "Custom Type" && bot.message_template) {
          // Use template with variables replaced
          message = replaceTemplateVars(bot.message_template, assignedName, taskDescription);
        } else {
          // Default format
          message = `${taskDescription} - ${assignedName}'s turn`;
        }

        // Send SMS to all accepted members
        for (const member of members) {
          const smsResult = await sendSMS(member.phone_number, message);

          // Log the message
          await supabase.from("message_log").insert({
            bot_id: bot.id,
            to_phone: member.phone_number,
            body: message,
            status: smsResult.success ? "sent" : "failed",
            twilio_sid: smsResult.sid,
            error: smsResult.error || null,
          });

          console.log(`Sent SMS to ${member.name} (${member.phone_number}): ${smsResult.success ? 'success' : 'failed'}`);
        }

        // Update bot_groups rotation
        await supabase
          .from("bot_groups")
          .update({
            current_member_index: nextIndex,
          })
          .eq("id", botGroup.id);

        results.push({
          bot_id: bot.id,
          bot_name: bot.name,
          group_id: groupId,
          group_name: botGroup.groups.name,
          assigned_to: assignedMember.name,
          members_notified: members.length,
        });
      }

      // Update bot's last_sent_date
      await supabase
        .from("bots")
        .update({ last_sent_date: currentDate })
        .eq("id", bot.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        time: currentTime,
        date: currentDate,
        processed: results,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
