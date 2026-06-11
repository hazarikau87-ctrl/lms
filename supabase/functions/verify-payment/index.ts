import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const { appointmentId, labId, amount, paymentMethod, transactionRef, notes } = await req.json();

  if (!appointmentId || !labId || !amount || !paymentMethod) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { data: appt, error: aptError } = await supabase
    .from("appointments")
    .select("id, lab_id, booking_id")
    .eq("id", appointmentId)
    .eq("lab_id", labId)
    .single();

  if (aptError || !appt) {
    return new Response(JSON.stringify({ error: "Appointment not found" }), {
      status: 404,
      headers: corsHeaders,
    });
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert([{
      appointment_id: appointmentId,
      lab_id: labId,
      amount_paid: amount,
      payment_method: paymentMethod,
      transaction_ref: transactionRef || null,
      payment_status: "paid",
      notes: notes || null,
    }])
    .select()
    .single();

  if (paymentError) {
    return new Response(JSON.stringify({ error: paymentError.message }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify(payment), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});