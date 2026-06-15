import { useState, useEffect, useRef } from "react";

const PLANS = [
  {
    id: "499",
    price: 499,
    label: "Starter",
    tagline: "Perfect for single-location labs",
    features: [
      "Up to 200 appointments/month",
      "Booking + billing module",
      "PDF & Excel export",
      "WhatsApp reminders",
      "Basic reports",
    ],
    accent: "#4f46e5",
    accentLight: "#eef2ff",
    accentBorder: "#c7d2fe",
  },
  {
    id: "799",
    price: 799,
    label: "Growth",
    tagline: "For labs scaling operations",
    popular: true,
    features: [
      "Up to 800 appointments/month",
      "Everything in Starter",
      "Doctor directory + commissions",
      "Revenue analytics dashboard",
      "Barcode specimen labels",
      "UPI QR payment collection",
    ],
    accent: "#0284c7",
    accentLight: "#e0f2fe",
    accentBorder: "#bae6fd",
  },
  {
    id: "1499",
    price: 1499,
    label: "Enterprise",
    tagline: "Full platform, no limits",
    features: [
      "Unlimited appointments",
      "Everything in Growth",
      "Multi-branch support",
      "Custom branding & theme",
      "Priority support",
      "Advanced ledger & settlements",
      "API access",
    ],
    accent: "#059669",
    accentLight: "#ecfdf5",
    accentBorder: "#a7f3d0",
  },
];

const STEPS = [
  { id: 1, label: "Lab Info" },
  { id: 2, label: "Admin" },
  { id: 3, label: "Plan" },
  { id: 4, label: "Confirm" },
];

const TIME_SLOTS = [
  "06:00","07:00","08:00","09:00","10:00","11:00",
  "12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00",
];

const input =
  "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";

const label = "block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5";

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5 font-medium">
      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 4.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5zm-.75 6a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z"/></svg>
      {msg}
    </p>
  );
}

function StepDot({ step, current, done }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
        done ? "bg-indigo-600 border-indigo-600 text-white" :
        current ? "border-indigo-600 text-indigo-600 bg-indigo-50" :
        "border-slate-200 text-slate-400 bg-white"
      }`}>
        {done ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
        ) : step.id}
      </div>
      <span className={`text-[10px] font-semibold uppercase tracking-wide ${current ? "text-indigo-600" : "text-slate-400"}`}>{step.label}</span>
    </div>
  );
}

export default function LabOnboardingForm() {
  const [activeStep, setActiveStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState("799");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    lab_name: "",
    phone: "",
    whatsapp: "",
    email: "",
    city: "",
    state: "",
    pincode: "",
    address: "",
    open_time: "08:00",
    close_time: "20:00",
    admin_name: "",
    admin_email: "",
    admin_password: "",
    admin_confirm_password: "",
    admin_phone: "",
    agreed: false,
  });

  const f = (key) => ({
    value: form[key],
    onChange: (e) => setForm((p) => ({ ...p, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value })),
    className: errors[key] ? input.replace("border-slate-200", "border-red-400").replace("focus:border-indigo-400", "focus:border-red-400") : input,
  });

  function validateStep1() {
    const e = {};
    if (!form.lab_name.trim()) e.lab_name = "Lab name is required";
    if (!form.phone.match(/^[0-9]{10}$/)) e.phone = "Enter a valid 10-digit number";
    if (!form.email.includes("@")) e.email = "Enter a valid email";
    if (!form.city.trim()) e.city = "City is required";
    if (!form.state.trim()) e.state = "State is required";
    if (!form.pincode.match(/^[0-9]{6}$/)) e.pincode = "Enter 6-digit PIN";
    return e;
  }

  function validateStep2() {
    const e = {};
    if (!form.admin_name.trim()) e.admin_name = "Name is required";
    if (!form.admin_email.includes("@")) e.admin_email = "Enter a valid email";
    if (form.admin_password.length < 8) e.admin_password = "Password must be 8+ characters";
    if (form.admin_password !== form.admin_confirm_password) e.admin_confirm_password = "Passwords don't match";
    return e;
  }

  function handleNext() {
    const errs = activeStep === 1 ? validateStep1() : activeStep === 2 ? validateStep2() : {};
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setActiveStep((p) => p + 1);
  }

  async function handleSubmit() {
    if (!form.agreed) { setErrors({ agreed: "You must accept the terms to continue" }); return; }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1800));
    setSubmitting(false);
    setSubmitted(true);
  }

  const plan = PLANS.find((p) => p.id === selectedPlan);

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm max-w-md w-full p-10 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: "#ecfdf5" }}>
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">You're all set!</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-1">
            <span className="font-semibold text-slate-700">{form.lab_name}</span> has been registered on LabOps Scheduler.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Your <span className="font-semibold text-indigo-600">{plan.label}</span> plan is active — with <span className="font-bold text-emerald-600">30 days free</span>, all features unlocked.
          </p>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-left">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">What's next</p>
            {["Login to your dashboard", "Configure your test catalog", "Add referring doctors", "Start accepting bookings"].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1.5">
                <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">{i + 1}</div>
                <span className="text-xs font-medium text-slate-600">{item}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setSubmitted(false); setActiveStep(1); setForm({ lab_name:"",phone:"",whatsapp:"",email:"",city:"",state:"",pincode:"",address:"",open_time:"08:00",close_time:"20:00",admin_name:"",admin_email:"",admin_password:"",admin_confirm_password:"",admin_phone:"",agreed:false }); }}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-600/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
            </div>
            <div className="text-left">
              <p className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">LabOps Scheduler</p>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">by Zebnox</p>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Register your laboratory</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Start with <span className="font-semibold text-emerald-600">30 days free</span> — all features unlocked, no card needed.
          </p>
        </div>

        {/* Step Progress */}
        <div className="flex items-start justify-between relative mb-8 px-4">
          <div className="absolute top-4 left-8 right-8 h-px bg-slate-200 z-0" />
          {STEPS.map((step) => (
            <div key={step.id} className="relative z-10 bg-slate-50 px-2">
              <StepDot step={step} current={activeStep === step.id} done={activeStep > step.id} />
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">

          {/* Step 1: Lab Information */}
          {activeStep === 1 && (
            <div>
              <div className="px-7 py-5 border-b border-slate-100 bg-slate-50/40">
                <h2 className="text-sm font-bold text-slate-900">Laboratory details</h2>
                <p className="text-xs text-slate-500 mt-0.5">Tell us about your diagnostic centre</p>
              </div>
              <div className="px-7 py-6 space-y-5">
                <div>
                  <label className={label}>Lab name <span className="text-red-400 normal-case tracking-normal">*</span></label>
                  <input type="text" placeholder="e.g. Apollo Diagnostics, Sunrise Lab" {...f("lab_name")} />
                  <FieldError msg={errors.lab_name} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={label}>Contact number <span className="text-red-400 normal-case tracking-normal">*</span></label>
                    <input type="tel" placeholder="10-digit mobile" {...f("phone")} />
                    <FieldError msg={errors.phone} />
                  </div>
                  <div>
                    <label className={label}>WhatsApp number</label>
                    <input type="tel" placeholder="For alerts & updates" {...f("whatsapp")} />
                  </div>
                </div>

                <div>
                  <label className={label}>Lab email <span className="text-red-400 normal-case tracking-normal">*</span></label>
                  <input type="email" placeholder="lab@example.com" {...f("email")} />
                  <FieldError msg={errors.email} />
                </div>

                <div>
                  <label className={label}>Street address</label>
                  <textarea rows={2} placeholder="Building, street name, locality…" {...f("address")} className={input + " resize-none"} style={{ resize: "none" }} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={label}>City <span className="text-red-400 normal-case tracking-normal">*</span></label>
                    <input type="text" placeholder="City" {...f("city")} />
                    <FieldError msg={errors.city} />
                  </div>
                  <div>
                    <label className={label}>State <span className="text-red-400 normal-case tracking-normal">*</span></label>
                    <input type="text" placeholder="State" {...f("state")} />
                    <FieldError msg={errors.state} />
                  </div>
                  <div>
                    <label className={label}>Pincode <span className="text-red-400 normal-case tracking-normal">*</span></label>
                    <input type="text" placeholder="6-digit PIN" maxLength={6} {...f("pincode")} />
                    <FieldError msg={errors.pincode} />
                  </div>
                </div>

                <div>
                  <label className={label}>Operating hours</label>
                  <div className="flex items-center gap-3">
                    <select value={form.open_time} onChange={(e) => setForm((p) => ({ ...p, open_time: e.target.value }))} className={input} style={{ appearance: "auto" }}>
                      {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-slate-400 text-sm font-semibold flex-shrink-0">to</span>
                    <select value={form.close_time} onChange={(e) => setForm((p) => ({ ...p, close_time: e.target.value }))} className={input} style={{ appearance: "auto" }}>
                      {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Admin Account */}
          {activeStep === 2 && (
            <div>
              <div className="px-7 py-5 border-b border-slate-100 bg-slate-50/40">
                <h2 className="text-sm font-bold text-slate-900">Admin account</h2>
                <p className="text-xs text-slate-500 mt-0.5">This will be your login credentials for the dashboard</p>
              </div>
              <div className="px-7 py-6 space-y-5">
                <div>
                  <label className={label}>Full name <span className="text-red-400 normal-case tracking-normal">*</span></label>
                  <input type="text" placeholder="Dr. Priya Sharma" {...f("admin_name")} />
                  <FieldError msg={errors.admin_name} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={label}>Admin email <span className="text-red-400 normal-case tracking-normal">*</span></label>
                    <input type="email" placeholder="admin@yourlab.com" {...f("admin_email")} />
                    <FieldError msg={errors.admin_email} />
                  </div>
                  <div>
                    <label className={label}>Admin phone</label>
                    <input type="tel" placeholder="Mobile number" {...f("admin_phone")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={label}>Password <span className="text-red-400 normal-case tracking-normal">*</span></label>
                    <input type="password" placeholder="Min 8 characters" {...f("admin_password")} />
                    <FieldError msg={errors.admin_password} />
                  </div>
                  <div>
                    <label className={label}>Confirm password <span className="text-red-400 normal-case tracking-normal">*</span></label>
                    <input type="password" placeholder="Re-enter password" {...f("admin_confirm_password")} />
                    <FieldError msg={errors.admin_confirm_password} />
                  </div>
                </div>

                {form.admin_password.length > 0 && (
                  <div>
                    <div className="flex gap-1 mb-1">
                      {[
                        form.admin_password.length >= 8,
                        /[A-Z]/.test(form.admin_password),
                        /[0-9]/.test(form.admin_password),
                        /[^A-Za-z0-9]/.test(form.admin_password),
                      ].map((met, i) => (
                        <div key={i} className={`flex-1 h-1 rounded-full transition-all ${met ? "bg-emerald-500" : "bg-slate-200"}`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {[form.admin_password.length >= 8, /[A-Z]/.test(form.admin_password), /[0-9]/.test(form.admin_password), /[^A-Za-z0-9]/.test(form.admin_password)].filter(Boolean).length < 2
                        ? "Weak — add uppercase, numbers, symbols"
                        : [form.admin_password.length >= 8, /[A-Z]/.test(form.admin_password), /[0-9]/.test(form.admin_password), /[^A-Za-z0-9]/.test(form.admin_password)].filter(Boolean).length < 4
                        ? "Moderate"
                        : "Strong password"}
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Your admin email and password will be used to access the LabOps dashboard. Keep them secure — you can add more staff accounts later from Settings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Plan Selection */}
          {activeStep === 3 && (
            <div>
              <div className="px-7 py-5 border-b border-slate-100 bg-slate-50/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Choose your plan</h2>
                    <p className="text-xs text-slate-500 mt-0.5">All plans include a full 30-day free trial</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    30 days free
                  </div>
                </div>
              </div>
              <div className="px-7 py-6 space-y-3">
                {PLANS.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full text-left rounded-2xl border-2 p-5 transition-all relative ${
                      selectedPlan === plan.id ? "border-current shadow-sm" : "border-slate-200 hover:border-slate-300"
                    }`}
                    style={selectedPlan === plan.id ? { borderColor: plan.accent, backgroundColor: plan.accentLight } : {}}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-5">
                        <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-white" style={{ backgroundColor: plan.accent }}>
                          Most popular
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center transition-all`}
                          style={selectedPlan === plan.id ? { borderColor: plan.accent, backgroundColor: plan.accent } : { borderColor: "#CBD5E1" }}>
                          {selectedPlan === plan.id && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-extrabold text-slate-900">{plan.label}</span>
                            <span className="text-xs text-slate-500">{plan.tagline}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                            {plan.features.map((f, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: plan.accent }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                <span className="text-[11px] font-medium text-slate-600">{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-extrabold text-slate-900">₹{plan.price}</div>
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">/ month</div>
                        <div className="mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">30 days free</div>
                      </div>
                    </div>
                  </button>
                ))}

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 mt-2">
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <span className="font-bold">No credit card required.</span> Your 30-day trial starts immediately after registration. Upgrade, downgrade, or cancel anytime from your billing settings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {activeStep === 4 && (
            <div>
              <div className="px-7 py-5 border-b border-slate-100 bg-slate-50/40">
                <h2 className="text-sm font-bold text-slate-900">Confirm your registration</h2>
                <p className="text-xs text-slate-500 mt-0.5">Review the details before we create your workspace</p>
              </div>
              <div className="px-7 py-6 space-y-5">
                {/* Summary Cards */}
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-3">Laboratory</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Name</span>
                        <span className="font-semibold text-slate-900">{form.lab_name || "—"}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Contact</span>
                        <span className="font-semibold text-slate-900">{form.phone || "—"}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Email</span>
                        <span className="font-semibold text-slate-900">{form.email || "—"}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Location</span>
                        <span className="font-semibold text-slate-900">{[form.city, form.state, form.pincode].filter(Boolean).join(", ") || "—"}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Hours</span>
                        <span className="font-semibold text-slate-900">{form.open_time} – {form.close_time}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-3">Admin account</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Admin name</span>
                        <span className="font-semibold text-slate-900">{form.admin_name || "—"}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Login email</span>
                        <span className="font-semibold text-slate-900">{form.admin_email || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border-2 p-4" style={{ borderColor: plan.accent, backgroundColor: plan.accentLight }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-widest mb-0.5" style={{ color: plan.accent }}>Selected plan</p>
                        <p className="text-sm font-extrabold text-slate-900">{plan.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{plan.tagline}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-extrabold text-slate-900">₹{plan.price}</div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">/month</div>
                        <div className="mt-1 text-xs font-bold text-emerald-600">First 30 days free</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.agreed}
                    onChange={(e) => setForm((p) => ({ ...p, agreed: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/10 flex-shrink-0"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    I confirm that the above details are accurate and I agree to LabOps Scheduler's{" "}
                    <span className="text-indigo-600 font-semibold hover:underline cursor-pointer">Terms of Service</span>
                    {" "}and{" "}
                    <span className="text-indigo-600 font-semibold hover:underline cursor-pointer">Privacy Policy</span>.
                    I understand the 30-day free trial starts immediately upon registration.
                  </span>
                </label>
                <FieldError msg={errors.agreed} />
              </div>
            </div>
          )}

          {/* Footer Nav */}
          <div className="sticky bottom-0 flex items-center justify-between px-7 py-4 border-t border-slate-100 bg-white">
            <button
              type="button"
              disabled={activeStep === 1}
              onClick={() => setActiveStep((p) => p - 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-colors rounded-xl hover:bg-slate-100"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              Back
            </button>

            <div className="flex items-center gap-1.5">
              {STEPS.map((s) => (
                <div key={s.id} className={`rounded-full transition-all duration-300 ${s.id === activeStep ? "w-6 h-1.5 bg-indigo-600" : s.id < activeStep ? "w-2 h-1.5 bg-indigo-400" : "w-2 h-1.5 bg-slate-200"}`} />
              ))}
            </div>

            {activeStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-all hover:opacity-90 active:scale-[0.98] bg-indigo-600"
              >
                Continue
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 bg-indigo-600"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Setting up…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
                    Create workspace
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Trust Footer */}
        <div className="flex items-center justify-center gap-6 mt-6 pb-8">
          {[
            { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", text: "256-bit SSL" },
            { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", text: "HIPAA compliant" },
            { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", text: "Setup in 2 mins" },
          ].map(({ icon, text }, i) => (
            <div key={i} className="flex items-center gap-1.5 text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={icon}/></svg>
              <span className="text-[11px] font-semibold">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
