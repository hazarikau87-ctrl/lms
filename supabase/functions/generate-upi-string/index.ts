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

  const { appointmentId, labId, amount } = await req.json();

  if (!labId || !amount || amount <= 0) {
    return new Response(JSON.stringify({ error: "Invalid labId or amount" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { data: lab, error: labError } = await supabase
    .from("labs")
    .select("id, lab_name, upi_id")
    .eq("id", labId)
    .single();

  if (labError || !lab || !lab.upi_id) {
    return new Response(
      JSON.stringify({ error: "Lab not found or UPI not configured" }),
      { status: 404, headers: corsHeaders }
    );
  }

  const upiString = `upi://pay?pa=${lab.upi_id}&pn=${encodeURIComponent(lab.lab_name)}&am=${amount}&cu=INR`;

  return new Response(
    JSON.stringify({ upiString, labName: lab.lab_name, amount }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});