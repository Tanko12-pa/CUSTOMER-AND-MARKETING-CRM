import React, { useState } from "react";
import { Sparkles, ShieldCheck, Mail, User, Lock, CreditCard, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { registerWithTrial, signInAndCheckTrial, resetUserPassword } from "../firebase";

interface SubscriptionGateProps {
  onRegisterTrial: (name: string, email: string) => Promise<void>;
  onLogin: (email: string) => Promise<void>;
  onSelectPlan: (plan: "monthly" | "yearly") => Promise<void>;
  currentUser: any;
  checkoutSimulated: { plan: "monthly" | "yearly"; email: string } | null;
  onConfirmSimulatedSubscription: (email: string, plan: "monthly" | "yearly") => Promise<void>;
  loading: boolean;
}

export function SubscriptionGate({
  onRegisterTrial,
  onLogin,
  onSelectPlan,
  currentUser,
  checkoutSimulated,
  onConfirmSimulatedSubscription,
  loading,
}: SubscriptionGateProps) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Helper function to handle view toggles and clear old error banners
  const switchMode = (targetMode: "register" | "login") => {
    setErrorText(""); // CRITICAL: Erases the error banner instantly on switch
    setMode(targetMode);
  };

  // Credit Card inputs for simulated Stripe screen
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/29");
  const [cardCvc, setCardCvc] = useState("123");
  const [cardName, setCardName] = useState("");

  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");
    if (!email.trim()) {
      setErrorText("Email address is required.");
      return;
    }
    if (!password.trim()) {
      setErrorText("Password is required.");
      return;
    }
    if (password.length < 6) {
      setErrorText("Password should be at least 6 characters.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setErrorText("Your name is required to start the trial.");
      return;
    }

    setLocalLoading(true);
    try {
      if (mode === "register") {
        await registerWithTrial(name, email, password);
      } else {
        await signInAndCheckTrial(email, password);
      }
    } catch (err: any) {
      if (err.message?.includes("auth/email-already-in-use") || err.code === "auth/email-already-in-use") {
        setErrorText(
          "An account with this email already exists. Please click 'Sign In' below to access your trial."
        );
      } else if (err.message?.includes("auth/invalid-credential") || err.code === "auth/invalid-credential") {
        setErrorText("Incorrect email or password. Please try again or reset your password.");
      } else {
        setErrorText(err.message || "An authentication anomaly occurred.");
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorText("Please enter your email address first.");
      return;
    }
    setLocalLoading(true);
    setErrorText("");
    try {
      const msg = await resetUserPassword(email);
      alert(msg);
    } catch (err: any) {
      setErrorText(err.message || "Could not dispatch reset email.");
    } finally {
      setLocalLoading(false);
    }
  };

  const isAuthLoading = loading || localLoading;

  const handleSimulatedPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutSimulated) return;
    setPaymentLoading(true);
    setErrorText("");

    try {
      // Simulate API lag
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await onConfirmSimulatedSubscription(checkoutSimulated.email, checkoutSimulated.plan);
    } catch (err: any) {
      setErrorText(err.message || "Payment processing error.");
    } finally {
      setPaymentLoading(false);
    }
  };

  // 1. Simulated Stripe checkout view
  if (checkoutSimulated) {
    const isMonthly = checkoutSimulated.plan === "monthly";
    const amountStr = isMonthly ? "$19.99 / month" : "$199.99 / year";

    return (
      <div className="min-h-screen bg-[#070708] text-[#E4E4E7] flex items-center justify-center p-4 font-sans" id="stripe-sim-screen">
        <div className="w-full max-w-md bg-[#141416] border border-[#C5A059]/40 rounded-2xl shadow-xl p-8 relative overflow-hidden">
          {/* Accent Glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-[#C5A059] to-yellow-600"></div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1 bg-[#C5A059]/10 text-[#C5A059] px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3" /> Secure Stripe Sandbox
            </div>
            <h2 className="text-xl font-bold font-display text-white">Stripe Checkout</h2>
            <p className="text-xs text-[#A1A1AA] mt-1">Paying subscription fees safely in preview environment</p>
          </div>

          <div className="bg-[#0A0A0B] p-4.5 rounded-xl border border-[#27272A] mb-6 font-mono text-xs text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-[#71717A]">PRODUCT:</span>
              <strong className="text-white">CRM Pro {isMonthly ? "Monthly" : "Yearly"}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71717A]">BILLING EMAIL:</span>
              <span className="text-white text-right truncate max-w-[200px]">{checkoutSimulated.email}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#27272A] text-sm">
              <span className="font-bold text-[#C5A059]">TOTAL DUE:</span>
              <strong className="text-white">{amountStr}</strong>
            </div>
          </div>

          {errorText && (
            <div className="bg-red-950/20 border border-red-900/40 text-red-400 p-3 rounded-xl text-xs mb-5 font-mono text-center">
              {errorText}
            </div>
          )}

          <form onSubmit={handleSimulatedPayment} className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA] mb-1.5">Cardholder Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-[#71717A]" />
                <input
                  type="text"
                  required
                  placeholder="Akindewum"
                  value={cardName}
                  onChange={(e) => {
                    setCardName(e.target.value);
                    if (errorText) setErrorText("");
                  }}
                  className="w-full bg-[#0A0A0B] border border-[#27272A] focus:border-[#C5A059] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E4E4E7] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA] mb-1.5">Card Details</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-[#71717A]" />
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => {
                    setCardNumber(e.target.value);
                    if (errorText) setErrorText("");
                  }}
                  className="w-full bg-[#0A0A0B] border border-[#27272A] focus:border-[#C5A059] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E4E4E7] outline-none font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => {
                      setCardExpiry(e.target.value);
                      if (errorText) setErrorText("");
                    }}
                    placeholder="MM/YY"
                    className="w-full bg-[#0A0A0B] border border-[#27272A] focus:border-[#C5A059] rounded-xl px-3 py-2 text-xs text-[#E4E4E7] outline-none text-center font-mono"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    required
                    maxLength={3}
                    value={cardCvc}
                    onChange={(e) => {
                      setCardCvc(e.target.value);
                      if (errorText) setErrorText("");
                    }}
                    placeholder="CVC"
                    className="w-full bg-[#0A0A0B] border border-[#27272A] focus:border-[#C5A059] rounded-xl px-3 py-2 text-xs text-[#E4E4E7] outline-none text-center font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={paymentLoading}
              className="w-full mt-6 bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#C5A059]/10"
            >
              {paymentLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Checkout Session...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authorize Payment {isMonthly ? "$19.99" : "$199.99"}</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[10px] text-[#71717A] text-center mt-6 font-mono leading-relaxed">
            🛡️ Encrypted via Stripe SSL. All payment configurations are executed server-side.
          </p>
          <div className="flex items-center justify-between text-[9px] text-[#A1A1AA] bg-[#0A0A0B] border border-[#27272A] px-2.5 py-1.5 rounded-lg w-full font-mono mt-3 select-all">
            <span>💳 KEY:</span>
            <span className="text-white font-bold opacity-80" title="Stripe Live Publishable Key">
              {import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_live_Y8I4kIWBXPdQIfZ2tthPIFwV00DlqCjZva"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Subscription Expired Wall (Redirected here after trial expiration)
  if (currentUser && !currentUser.active) {
    return (
      <div className="min-h-screen bg-[#070708] text-[#E4E4E7] flex flex-col items-center justify-center p-6 font-sans" id="subscription-renewal-wall">
        <div className="w-full max-w-2xl bg-[#141416] border border-[#27272A] rounded-2xl shadow-xl overflow-hidden">
          
          <div className="bg-[#1C1917]/30 border-b border-[#27272A] p-6 text-center">
            <div className="w-12 h-12 bg-red-950/30 border border-red-500/40 text-[#EF4444] rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Your 7-Day Free Trial Has Expired</h2>
            <p className="text-xs text-[#A1A1AA] font-mono mt-1">Logged in as {currentUser.email}</p>
          </div>

          <div className="p-8">
            <p className="text-sm text-center text-[#E4E4E7] mb-8 leading-relaxed max-w-lg mx-auto">
              To regain continuous access to the entire **Customer & Marketing CRM suite** (including Lead scoring, AI campaigns, transcription translation, and live consoles), select one of our business subscription tiers below.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              
              {/* Monthly Subscription */}
              <div className="bg-[#0A0A0B] border border-[#27272A] hover:border-[#C5A059]/40 p-6 rounded-xl relative flex flex-col justify-between transition-all">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs uppercase font-bold tracking-wider text-[#A1A1AA] font-mono">Monthly</span>
                    <span className="text-[10px] bg-[#C5A059]/10 text-[#C5A059] font-bold px-2 py-0.5 rounded-full uppercase">Standard</span>
                  </div>
                  <div className="text-2xl font-bold font-display text-white mt-2 mb-4">
                    $19.99<span className="text-xs text-[#A1A1AA] font-normal"> / month</span>
                  </div>
                  <ul className="text-xs text-[#A1A1AA] space-y-2 mb-6 text-left">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" /> 100% Core CRM Module Usage
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" /> High-Level Deal Risk Assessments
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" /> AI-Powered Copy Creation
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectPlan("monthly")}
                  disabled={loading}
                  className="w-full bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/30 hover:bg-[#C5A059]/20 font-bold py-2.5 rounded-xl text-xs tracking-wide uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Subscribe Monthly</span>}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Yearly Subscription */}
              <div className="bg-[#141416] border-2 border-[#C5A059]/80 p-6 rounded-xl relative flex flex-col justify-between transition-all shadow-lg shadow-[#C5A059]/5">
                <div className="absolute top-0 right-4 transform -translate-y-1/2">
                  <span className="bg-[#C5A059] text-[#0A0A0B] text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                    SAVE 17% ANNUALLY
                  </span>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs uppercase font-bold tracking-wider text-[#C5A059] font-mono">Yearly Pass</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase">Unrestricted</span>
                  </div>
                  <div className="text-2xl font-bold font-display text-white mt-2 mb-4">
                    $199.99<span className="text-xs text-[#A1A1AA] font-normal"> / year</span>
                  </div>
                  <ul className="text-xs text-[#A1A1AA] space-y-2 mb-6 text-left">
                    <li className="flex items-center gap-1.5 uppercase font-bold text-white text-[10px]">
                      ✨ ALL MONTHLY CAPABILITIES INCLUDED
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" /> Premium low-latency AI responses
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" /> Unlimited Multilingual Voice translating
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectPlan("yearly")}
                  disabled={loading}
                  className="w-full bg-[#C5A059] text-[#0A0A0B] font-bold py-2.5 rounded-xl text-xs tracking-wide uppercase transition-colors hover:bg-[#C5A059]/90 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Subscribe Yearly</span>}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-[#71717A] border-t border-[#27272A] pt-4 font-mono">
              <span>Billing questions?</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.reload();
                  } catch (e) {}
                }}
                className="text-[#C5A059] hover:underline cursor-pointer"
              >
                Log Out of Account
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // 3. Subscription welcome screen (User registration and log in flow)
  return (
    <div className="min-h-screen bg-[#070708] text-[#E4E4E7] flex flex-col items-center justify-center p-4 font-sans" id="subscription-landing-gateway">
      <div className="w-full max-w-lg bg-[#141416] border border-[#27272A] rounded-2xl shadow-xl overflow-hidden relative">
        {/* Subtle decorative background gradient accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#C5A059]/5 rounded-full filter blur-3xl pointer-events-none"></div>

        <div className="p-8 text-center">
          
          <div className="w-14 h-14 bg-[#C5A059]/10 text-[#C5A059] rounded-2xl border border-[#C5A059]/30 flex items-center justify-center mx-auto mb-5 select-none font-display font-black text-2xl tracking-widest shadow-inner">
            CRM
          </div>

          <h1 className="text-2xl font-bold font-display uppercase tracking-tight text-white">
            Customer & Marketing CRM
          </h1>
          <p className="text-xs text-[#A1A1AA] font-mono mt-1.5 tracking-wider uppercase">
            Executive Revenue Intelligence Gate
          </p>

          <div className="my-6 border-y border-[#27272A]/80 py-4.5 text-left text-xs text-[#A1A1AA] space-y-3 max-w-sm mx-auto">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <span>
                <strong>Subscription Protected Suite</strong>: All users can access and evaluate the platform through our official trial & sub channels.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <span>
                <strong>100% Free Trial</strong>: Enjoy 7 full days of enterprise pipeline diagnostics before selecting an upgrade module.
              </span>
            </div>
          </div>

          {errorText && (
            <div className="bg-red-950/20 border border-red-900/40 text-red-400 p-3 rounded-xl text-xs mb-5 font-mono">
              {errorText}
            </div>
          )}

          <form onSubmit={handleSubmitAuth} className="space-y-4 max-w-sm mx-auto text-left">
            {mode === "register" && (
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA] mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-[#71717A]" />
                  <input
                    type="text"
                    required
                    placeholder="Marcus Aurelius"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errorText) setErrorText("");
                    }}
                    className="w-full bg-[#0A0A0B] border border-[#27272A] focus:border-[#C5A059] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E4E4E7] outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#71717A]" />
                <input
                  type="email"
                  required
                  placeholder="your.email@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorText) setErrorText("");
                  }}
                  className="w-full bg-[#0A0A0B] border border-[#27272A] focus:border-[#C5A059] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E4E4E7] outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#71717A]" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorText) setErrorText("");
                  }}
                  className="w-full bg-[#0A0A0B] border border-[#27272A] focus:border-[#C5A059] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E4E4E7] outline-none transition-colors"
                />
              </div>
              {mode === "login" && (
                <div className="text-right mt-1.5">
                  <span 
                    className="forgot-password-link text-[#C5A059] hover:underline text-[10px] font-mono" 
                    onClick={async () => {
                      if (!email) {
                        setErrorText("Please type your email address into the input field above first, then click Forgot Password.");
                        return;
                      }
                      try {
                        setErrorText('');
                        await resetUserPassword(email);
                        alert(`A secure password reset link has been dispatched to ${email}`);
                      } catch (err: any) {
                        setErrorText(err.message || "An authentication anomaly occurred.");
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    Forgot Password?
                  </span>
                </div>
              )}
            </div>

            {mode === "register" ? (
              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-[#C5A059]/10 mt-6"
              >
                {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Start 7-Day Free Trial</span>}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full bg-[#141416] border border-[#27272A] hover:bg-white/5 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-6"
              >
                {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Sign In & Continue Trial</span>}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Toggle between Register/Login */}
          <div className="mt-6 text-xs font-mono text-[#D4D4D8] text-center">
            {mode === "register" ? (
              <p>
                Already registered a free trial?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-[#C5A059] hover:underline font-bold cursor-pointer"
                >
                  Sign In (Access Trial / Account)
                </button>
              </p>
            ) : (
              <p>
                First time visitor evaluating CRM?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="text-[#C5A059] hover:underline font-bold cursor-pointer"
                >
                  Register Free Trial
                </button>
              </p>
            )}
          </div>

        </div>

        {/* Informative, luxurious pricing notice card at bottom */}
        <div className="bg-[#0A0A0B]/60 border-t border-[#27272A]/80 p-6 flex flex-col justify-between items-center sm:flex-row gap-3">
          <div className="text-left font-sans">
            <p className="text-[10px] text-white uppercase font-bold tracking-wider font-mono">Premium Plans Available</p>
            <p className="text-[11px] text-[#A1A1AA] mt-0.5">Upgrade anytime starting at $19.99/mo</p>
            <div className="mt-1.5 flex items-center gap-1.5 text-[8.5px] font-mono text-[#D4D4D8]">
              <span className="text-[#C5A059] font-bold">💳 Stripe PubKey:</span>
              <span className="bg-white/5 border border-white/10 px-1 py-0.2 rounded truncate max-w-[130px]" title="pk_live_Y8I4kIWBXPdQIfZ2tthPIFwV00DlqCjZva">
                {import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_live_Y8I4kIWBXPdQIfZ2tthPIFwV00DlqCjZva"}
              </span>
            </div>
          </div>
          <div className="flex space-x-2 text-[10px] font-mono shrink-0">
            <span className="px-2.5 py-1 bg-[#141416] border border-[#27272A] rounded text-[#A1A1AA] font-bold font-semibold">Monthly: $19.99</span>
            <span className="px-2.5 py-1 bg-[#121214] border border-[#C5A059]/30 rounded text-[#C5A059] font-bold font-semibold">Yearly: $199.99</span>
          </div>
        </div>

      </div>
    </div>
  );
}
