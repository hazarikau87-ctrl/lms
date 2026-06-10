import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { supabase } from "../lib/supabase";

type PaymentMethod = "cash" | "upi" | "card_external";

interface BillingModuleProps {
  appointmentId: number;
  labId: string;
  selectedTests: string[];
  availableTestsMeta: any[] | null;
  onPaymentSuccess?: (payment: Record<string, unknown>) => void;
  themeColor?: string;
}

const fmt = (n:number)=>"₹"+Number(n).toLocaleString("en-IN");

export default function BillingModule({
  appointmentId,
  labId,
  selectedTests=[],
  availableTestsMeta=[],
  onPaymentSuccess,
  themeColor="#4f46e5"
}:BillingModuleProps){

  const [loading,setLoading]=useState(true);
  const [payments,setPayments]=useState<any[]>([]);
  const [lab,setLab]=useState<any>(null);
  const [method,setMethod]=useState<PaymentMethod>("cash");
  const [amount,setAmount]=useState("");
  const [transactionRef,setTransactionRef]=useState("");
  const [notes,setNotes]=useState("");
  const [verified,setVerified]=useState(false);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  const totalBill = (availableTestsMeta || [])
    .filter((t:any)=>selectedTests.includes(t?.name || t?.test_name || ""))
    .reduce((s:number,t:any)=>s+Number(t?.price||0),0);

  const collected = useMemo(
    ()=>payments.reduce((s,p)=>s+Number(p.amount_paid||0),0),
    [payments]
  );

  const balance = Math.max(totalBill-collected,0);

  const status =
    collected <= 0 ? "UNPAID" :
    collected < totalBill ? "PARTIALLY PAID" :
    "PAID";

  useEffect(()=>{
    load();
  },[appointmentId,labId]);

  async function load(){
    setLoading(true);

    const [{data:pay},{data:labData}] = await Promise.all([
      supabase.from("payments")
      .select("*")
      .eq("appointment_id",appointmentId)
      .eq("lab_id",labId)
      .order("created_at",{ascending:false}),

      supabase.from("labs")
      .select("lab_name,upi_id")
      .eq("id",labId)
      .single()
    ]);

    setPayments(pay || []);
    setLab(labData);
    setLoading(false);
  }

  const amountNumber = Number(amount || 0);

  const upiString =
    method==="upi" && lab?.upi_id
      ? `upi://pay?pa=${lab.upi_id}&pn=${encodeURIComponent(lab.lab_name)}&am=${amountNumber}&cu=INR`
      : "";

  async function collectPayment(){
    setError("");

    if(amountNumber<=0){
      setError("Enter a valid amount");
      return;
    }

    if(amountNumber > balance){
      setError("Amount exceeds pending balance");
      return;
    }

    if(method==="upi" && !verified){
      setError("Please verify UPI payment first");
      return;
    }

    setSaving(true);

    const {data,error} = await supabase
      .from("payments")
      .insert([{
        appointment_id: appointmentId,
        lab_id: labId,
        amount_paid: amountNumber,
        payment_method: method,
        transaction_ref: transactionRef || null,
        notes: notes || null,
        payment_status: "paid"
      }])
      .select()
      .single();

    setSaving(false);

    if(error){
      setError(error.message);
      return;
    }

    setAmount("");
    setTransactionRef("");
    setNotes("");
    setVerified(false);

    await load();

    onPaymentSuccess?.(data);
  }

  if(loading){
    return <div className="p-6 bg-white rounded-2xl border">Loading billing...</div>
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card title="Total Bill" value={fmt(totalBill)} />
        <Card title="Collected" value={fmt(collected)} />
        <Card title="Balance" value={fmt(balance)} />
        <Card title="Status" value={status} />
      </div>

      {balance > 0 && (
      <div className="border rounded-xl p-4">
        <h3 className="font-semibold mb-4">Collect Payment</h3>

        <input
          value={amount}
          onChange={(e)=>setAmount(e.target.value)}
          placeholder="Amount to collect"
          type="number"
          className="w-full border rounded-lg p-3 mb-3"
        />

        <div className="grid grid-cols-3 gap-2 mb-4">
          <button onClick={()=>setMethod("cash")} className="border rounded-lg p-2">Cash</button>
          <button onClick={()=>setMethod("upi")} className="border rounded-lg p-2">UPI</button>
          <button onClick={()=>setMethod("card_external")} className="border rounded-lg p-2">Card</button>
        </div>

        {method==="upi" && amountNumber>0 && lab?.upi_id && (
          <div className="border rounded-xl p-4 text-center mb-4">
            <QRCode value={upiString} size={180} />
            <div className="mt-3 text-sm">{lab.upi_id}</div>
            <div className="font-semibold">Scan & Pay {fmt(amountNumber)}</div>

            <label className="block mt-4 text-sm">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e)=>setVerified(e.target.checked)}
                className="mr-2"
              />
              Payment received and verified by lab
            </label>
          </div>
        )}

        <input
          value={transactionRef}
          onChange={(e)=>setTransactionRef(e.target.value)}
          placeholder="UTR / Reference"
          className="w-full border rounded-lg p-3 mb-3"
        />

        <textarea
          value={notes}
          onChange={(e)=>setNotes(e.target.value)}
          placeholder="Notes"
          className="w-full border rounded-lg p-3 mb-3"
        />

        {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

        <button
          onClick={collectPayment}
          disabled={saving}
          className="w-full text-white rounded-xl p-3 font-semibold"
          style={{backgroundColor: themeColor}}
        >
          {saving ? "Saving..." : "Record Payment"}
        </button>
      </div>
      )}

      <div>
        <h3 className="font-semibold mb-3">Payment History</h3>

        <div className="space-y-3">
          {payments.length===0 && (
            <div className="text-gray-500">No payments recorded.</div>
          )}

          {payments.map((p)=>(
            <div key={p.id} className="border rounded-xl p-3 flex justify-between">
              <div>
                <div className="font-medium">{fmt(p.amount_paid)}</div>
                <div className="text-sm text-gray-500">
                  {p.payment_method}
                </div>
                {p.transaction_ref && (
                  <div className="text-xs">Ref: {p.transaction_ref}</div>
                )}
              </div>

              <div className="text-xs text-gray-500">
                {new Date(p.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({title,value}:{title:string,value:string}){
  return(
    <div className="rounded-xl border p-3">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="font-bold mt-1">{value}</div>
    </div>
  )
}
