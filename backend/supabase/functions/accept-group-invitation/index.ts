/// <reference types="https://esm.sh/@supabase/functions-js@2/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Create Supabase client with user's auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Parse request body
    const { invitation_id, action } = await req.json();

    if (!invitation_id || !action) {
      return new Response(JSON.stringify({ error: "Missing invitation_id or action" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (action !== "accept" && action !== "decline") {
      return new Response(JSON.stringify({ error: "Action must be 'accept' or 'decline'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Fetch user's profile to get phone number
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("phone_number, name")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Fetch invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("group_invitations")
      .select("*")
      .eq("id", invitation_id)
      .eq("status", "pending")
      .single();

    if (invitationError || !invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found or already responded" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Verify phone number matches
    if (invitation.invitee_phone_number !== profile.phone_number) {
      return new Response(JSON.stringify({ error: "Invitation phone number does not match your profile" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Use service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "accept") {
      // Create group_member record
      const { error: memberError } = await supabaseAdmin
        .from("group_members")
        .insert({
          group_id: invitation.group_id,
          name: profile.name,
          phone_number: profile.phone_number,
          user_id: user.id,
          invitation_status: "accepted",
        });

      if (memberError) {
        console.error("Error creating group member:", memberError);
        return new Response(JSON.stringify({ error: "Failed to accept invitation" }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      // Update invitation status
      const { error: updateError } = await supabaseAdmin
        .from("group_invitations")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
          created_by_user_id: user.id,
        })
        .eq("id", invitation_id);

      if (updateError) {
        console.error("Error updating invitation:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update invitation" }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Invitation accepted successfully" }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } else {
      // Decline invitation
      const { error: updateError } = await supabaseAdmin
        .from("group_invitations")
        .update({
          status: "declined",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invitation_id);

      if (updateError) {
        console.error("Error declining invitation:", updateError);
        return new Response(JSON.stringify({ error: "Failed to decline invitation" }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Invitation declined" }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  } catch (error) {
    console.error("Error processing invitation:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
