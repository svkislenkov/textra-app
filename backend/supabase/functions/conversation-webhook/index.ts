/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const MOCK_MODE = !Deno.env.get("TWILIO_ACCOUNT_SID");
const ACC = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TOK = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

// Check if message is from a user (not bot or system)
function isUserMessage(author: string): boolean {
  return author.startsWith('+') && /^\+[1-9]\d{10,14}$/.test(author);
}

// Check if message is already prefixed (idempotency for retries)
function isAlreadyPrefixed(body: string): boolean {
  return /^.+ said: '.+'$/.test(body);
}

Deno.serve(async (req) => {
  // Parse Twilio Conversations webhook payload (JSON)
  const payload = await req.json();

  const {
    EventType,
    ConversationSid,
    MessageSid,
    Author,  // Phone number for SMS participants, empty for API messages
    Body,
  } = payload;

  // Only handle new messages
  if (EventType !== 'onMessageAdded') {
    return new Response('OK', { status: 200 });
  }

  // Ignore bot/system messages (only process user messages)
  if (!isUserMessage(Author)) {
    console.log(`Ignoring non-user message from: ${Author}`);
    return new Response('OK', { status: 200 });
  }

  // Ignore empty messages
  if (!Body?.trim()) {
    console.log('Ignoring empty message');
    return new Response('OK', { status: 200 });
  }

  // Ignore already-prefixed messages (retry protection)
  if (isAlreadyPrefixed(Body)) {
    console.log('Message already prefixed, skipping');
    return new Response('OK', { status: 200 });
  }

  // Lookup sender in bot_members to get display name
  const { data: members } = await supabase
    .from('bot_members')
    .select('display_name, bot_id')
    .eq('phone_e164', Author);

  // Determine display name (fallback to phone if not found)
  const displayName = members?.[0]?.display_name || Author;

  // Build prefixed message: "Alice said: 'original message'"
  const prefixedBody = `${displayName} said: '${Body}'`;

  console.log(`Prefixing message from ${displayName}: "${Body}"`);

  if (MOCK_MODE) {
    console.log('[MOCK MODE] Would post prefixed message and delete original');
    return new Response('OK (MOCK)', { status: 200 });
  }

  // Post new message with prefix
  const postUrl = `https://conversations.twilio.com/v1/Conversations/${ConversationSid}/Messages`;
  const postRes = await fetch(postUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${ACC}:${TOK}`),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ Body: prefixedBody }),
  });

  if (!postRes.ok) {
    console.error('Failed to post prefixed message:', await postRes.text());
    return new Response('Error posting message', { status: 500 });
  }

  const newMessage = await postRes.json();
  console.log(`Posted prefixed message: ${newMessage.sid}`);

  // Delete original message to avoid duplication
  const deleteUrl = `https://conversations.twilio.com/v1/Conversations/${ConversationSid}/Messages/${MessageSid}`;
  const deleteRes = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      Authorization: 'Basic ' + btoa(`${ACC}:${TOK}`),
    },
  });

  if (!deleteRes.ok) {
    // Log warning but don't fail (prefixed message already posted)
    console.warn('Failed to delete original message:', await deleteRes.text());
  } else {
    console.log(`Deleted original message: ${MessageSid}`);
  }

  return new Response('OK', { status: 200 });
});
