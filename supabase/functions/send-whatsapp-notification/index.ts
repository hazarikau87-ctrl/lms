import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Read request body
    const body = await req.json();
    const appointmentId = body?.appointmentId;

    if (!appointmentId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "appointmentId is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Supabase server client
    // ---------------------------------------------------------

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Supabase server credentials are not configured",
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    // ---------------------------------------------------------
    // Get appointment
    // ---------------------------------------------------------

    const { data: appointment, error: appointmentError } =
      await supabaseAdmin
        .from("appointments")
        .select(`
          id,
          name,
          mobile,
          whatsapp,
          email,
          appointment_date,
          time,
          test,
          booking_id,
          status,
          lab_id
        `)
        .eq("id", appointmentId)
        .single();

    if (appointmentError || !appointment) {
      console.error(
        "Appointment lookup error:",
        appointmentError,
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Appointment not found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Get lab WhatsApp configuration
    // ---------------------------------------------------------

    const { data: lab, error: labError } =
      await supabaseAdmin
        .from("labs")
        .select(`
          id,
          lab_name,
          wa_phone_number_id,
          wa_access_token
        `)
        .eq("id", appointment.lab_id)
        .single();

    if (labError || !lab) {
      console.error(
        "Lab lookup error:",
        labError,
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Lab not found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Check WhatsApp configuration
    // ---------------------------------------------------------

    if (
      !lab.wa_phone_number_id ||
      !lab.wa_access_token
    ) {
      console.log(
        `WhatsApp is not configured for lab ${lab.id}`,
      );

      return new Response(
        JSON.stringify({
          success: false,
          whatsappConfigured: false,
          message:
            "WhatsApp is not configured for this lab",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Patient WhatsApp number
    // ---------------------------------------------------------

    const recipient =
      appointment.whatsapp || appointment.mobile;

    if (!recipient) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Patient WhatsApp number is missing",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Normalize Indian phone number
    // ---------------------------------------------------------

    let phoneNumber = recipient.replace(/\D/g, "");

    if (phoneNumber.length === 10) {
      phoneNumber = `91${phoneNumber}`;
    }

    // ---------------------------------------------------------
    // WhatsApp message
    // ---------------------------------------------------------

    const message =
      `Hello ${appointment.name},\n\n` +
      `Your appointment request has been received by ${lab.lab_name}.\n\n` +
      `Booking ID: ${appointment.booking_id}\n` +
      `Date: ${appointment.appointment_date}\n` +
      `Time: ${appointment.time}\n` +
      `Test: ${appointment.test}\n\n` +
      `Status: ${appointment.status}\n\n` +
      `Thank you,\n${lab.lab_name}`;

    // ---------------------------------------------------------
    // Meta WhatsApp Cloud API
    // ---------------------------------------------------------

    const metaUrl =
      `https://graph.facebook.com/v23.0/` +
      `${lab.wa_phone_number_id}/messages`;

    const metaResponse = await fetch(metaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lab.wa_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      }),
    });

    const metaResult = await metaResponse.json();

    // ---------------------------------------------------------
    // Meta API error
    // ---------------------------------------------------------

    if (!metaResponse.ok) {
      console.error(
        "Meta WhatsApp API error:",
        JSON.stringify(metaResult),
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "WhatsApp message failed",
          metaError:
            metaResult?.error?.message ||
            "Unknown Meta error",
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Success
    // ---------------------------------------------------------

    console.log(
      `WhatsApp message sent for appointment ${appointment.id}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        whatsappConfigured: true,
        appointmentId: appointment.id,
        bookingId: appointment.booking_id,
        messageId:
          metaResult?.messages?.[0]?.id || null,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(
      "send-whatsapp-notification error:",
      error,
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});