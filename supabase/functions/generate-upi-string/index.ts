import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }

  const { appointmentId, labId, amount } = await req.json();

  // Validate inputs
  if (!labId || !amount || amount <= 0) {
    return new Response(
      JSON.stringify({ error: "Invalid labId or amount" }),
      { status: 400 }
    );
  }

  // Fetch lab data (server-side — user never sees raw upi_id)
  const { data: lab, error: labError } = await supabase
    .from("labs")
    .select("id, lab_name, upi_id")
    .eq("id", labId)
    .single();

  if (labError || !lab || !lab.upi_id) {
    return new Response(
      JSON.stringify({ error: "Lab not found or UPI not configured" }),
      { status: 404 }
    );
  }

  // Build the UPI string server-side
  const upiString = `upi://pay?pa=${lab.upi_id}&pn=${encodeURIComponent(
    lab.lab_name
  )}&am=${amount}&cu=INR`;

  // Return only the UPI string and QR data, never the raw ID
  return new Response(
    JSON.stringify({
      upiString,
      labName: lab.lab_name,
      amount,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
});