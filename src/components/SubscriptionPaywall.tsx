import React, { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, ShieldCheck, CreditCard, Lock, Loader2, LogOut, CheckCircle } from "lucide-react";

interface PaywallProps {
  userEmail: string;
  onLogout: () => void;
}

export const SubscriptionPaywall: React.FC<PaywallProps> = ({ userEmail, onLogout }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [checkoutSimulated, setCheckoutSimulated] = useState<{ plan: "monthly" | "yearly"; email: string } | null>(null);
  const [errorText, setErrorText] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Simulated credit card state
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/29");
  const [cardCvc, setCardCvc] = useState("123");

  const handleSubscribe = async (priceType: "monthly" | "yearly") => {
    setLoading(priceType);
    setErrorText("");
    try {
      // First try unified create-session endpoint
      const response = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: priceType, userId: userEmail }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to Live Stripe
      } else if (data.error) {
        // If Stripe is not configured, fall back to sandbox checkout simulation
        console.warn("Live Stripe not configured, entering Sandbox checkout simulation:", data.error);
        setCheckoutSimulated({ plan: priceType, email: userEmail });
      } else {
        setCheckoutSimulated({ plan: priceType, email: userEmail });
      }
    } catch (err) {
      console.warn("Stripe communication issue, falling back to Sandbox checkout simulation:", err);
      setCheckoutSimulated({ plan: priceType, email: userEmail });
    } finally {
      setLoading(null);
    }
  };

  const handleSimulatedPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutSimulated) return;
    setPaymentLoading(true);
    setErrorText("");

    try {
      // Simulate Stripe API authorization round-trip
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const response = await fetch("/api/auth/confirm-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: checkoutSimulated.email, plan: checkoutSimulated.plan }),
      });
      const data = await response.json();
      
      if (data.success) {
        // Redirect or hard-refresh to clear paywall guard and load dashboard
        window.location.href = `${window.location.origin}${window.location.pathname}?stripe_success=true&plan=${checkoutSimulated.plan}&email=${encodeURIComponent(checkoutSimulated.email)}`;
      } else {
        setErrorText(data.error || "Simulated payment processing error.");
      }
    } catch (err: any) {
      setErrorText(err.message || "Connection failure with subscription authority.");
    } finally {
      setPaymentLoading(false);
    }
  };

  if (checkoutSimulated) {
    const isMonthly = checkoutSimulated.plan === "monthly";
    const amountStr = isMonthly ? "$19.99 / month" : "$199.99 / year";

    return (
      <div className="fixed inset-0 z-50 bg-[#0A0A0B] flex items-center justify-center p-4 text-white font-sans" id="subscription-paywall-screen">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[#141416] border border-[#27272A] rounded-2xl p-6 shadow-2xl relative space-y-6"
        >
          <div className="text-center">
            <h2 className="text-xl font-bold uppercase tracking-tight text-white flex items-center justify-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#C5A059]" />
              Secure Stripe Sandbox
            </h2>
            <p className="text-[10px] text-[#C5A059] uppercase tracking-wider font-mono mt-1">Stripe Checkout Simulation</p>
          </div>
          <hr className="border-[#27272A]" />

          <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#27272A] text-xs space-y-2 font-mono">
            <div className="flex justify-between">
              <span className="text-[#71717A]">PRODUCT:</span>
              <strong className="text-white">CRM Pro {isMonthly ? "Monthly" : "Yearly"}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71717A]">BILLING EMAIL:</span>
              <span className="text-white text-right truncate max-w-[200px]" title={checkoutSimulated.email}>
                {checkoutSimulated.email}
              </span>
            </div>
            <hr className="border-[#27272A]/60" />
            <div className="flex justify-between text-sm font-bold">
              <span className="text-[#C5A059]">TOTAL DUE:</span>
              <span className="text-white">{amountStr}</span>
            </div>
          </div>

          {errorText && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs font-mono text-center">
              {errorText}
            </div>
          )}

          <form onSubmit={handleSimulatedPaymentSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] text-[#71717A] uppercase tracking-wider font-mono block mb-1.5">Cardholder Name</label>
              <div className="flex items-center gap-2 bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2.5">
                <span className="text-zinc-500">👤</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Akindewum"
                  value={cardName}
                  className="flex-1 bg-transparent border-none outline-none text-white text-xs font-mono"
                  onChange={(e) => {
                    setCardName(e.target.value);
                    setErrorText("");
                  }}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-[#71717A] uppercase tracking-wider font-mono block mb-1.5">Card Details</label>
              <div className="flex items-center gap-2 bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2.5 mb-2">
                <span className="text-zinc-500">💳</span>
                <input
                  type="text"
                  required
                  value={cardNumber}
                  className="flex-1 bg-transparent border-none outline-none text-white text-xs font-mono"
                  onChange={(e) => {
                    setCardNumber(e.target.value);
                    setErrorText("");
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2.5">
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="MM/YY"
                    value={cardExpiry}
                    className="w-full bg-transparent border-none outline-none text-white text-xs font-mono text-center"
                    onChange={(e) => {
                      setCardExpiry(e.target.value);
                      setErrorText("");
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2.5">
                  <input
                    type="password"
                    required
                    maxLength={3}
                    placeholder="CVC"
                    value={cardCvc}
                    className="w-full bg-transparent border-none outline-none text-white text-xs font-mono text-center"
                    onChange={(e) => {
                      setCardCvc(e.target.value);
                      setErrorText("");
                    }}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={paymentLoading}
              className="w-full py-3 px-4 bg-[#C5A059] hover:bg-[#C5A059]/90 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#C5A059]/10"
            >
              {paymentLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Authorizing Payment...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Confirm Simulation Purchase {isMonthly ? "$19.99" : "$199.99"}</span>
                </>
              )}
            </button>
          </form>

          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 pt-2 border-t border-[#27272A]/60">
            <button type="button" onClick={() => setCheckoutSimulated(null)} className="hover:text-white transition-colors">
              ← Change Plan
            </button>
            <span>🔒 Encrypted TLS Sandbox</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B] flex items-center justify-center p-4 text-white font-sans" id="subscription-paywall-screen">
      <motion.div 
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl w-full bg-[#141416] border border-[#27272A] rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/5 rounded-bl-full pointer-events-none" />
        
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-950/20 text-red-400 border border-red-900/40 rounded-full font-mono text-[9px] uppercase tracking-wider mb-5">
          <span>⚠️ Access Restricted // Redirected to Subscription & Billing</span>
        </div>

        <div className="w-16 h-16 bg-[#C5A059]/10 border border-[#C5A059]/30 rounded-2xl flex items-center justify-center mx-auto mb-5 animate-pulse">
          <span className="text-[#C5A059] font-bold text-2xl">⏳</span>
        </div>
        
        <h2 className="text-3xl font-bold tracking-tight mb-2 uppercase text-white font-display">
          Your 7-Day Free Trial Has Expired
        </h2>
        <p className="text-zinc-400 max-w-md mx-auto mb-8 text-xs leading-relaxed font-mono">
          To maintain secure operator dashboard telemetry access and continue executing growth modules, choose an active subscription tier below.
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
          {/* Monthly Card */}
          <div className="border border-[#27272A] bg-[#141416]/50 p-6 rounded-xl hover:border-[#C5A059]/30 transition-all flex flex-col justify-between text-left">
            <div>
              <h3 className="text-base font-bold text-white mb-1 uppercase font-display">Monthly Pro Suite</h3>
              <p className="text-zinc-500 text-[10px] mb-4">Flexible deployment cycle</p>
              <div className="text-3xl font-extrabold text-white mb-6 font-mono">
                $19.99<span className="text-xs font-normal text-zinc-500 font-mono">/mo</span>
              </div>
            </div>
            <button
              onClick={() => handleSubscribe("monthly")}
              disabled={loading !== null}
              className="w-full py-2.5 px-4 bg-white hover:bg-neutral-200 text-[#0A0A0B] font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center"
            >
              {loading === "monthly" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Select Monthly"
              )}
            </button>
          </div>

          {/* Yearly Card */}
          <div className="border-2 border-[#C5A059]/40 bg-[#C5A059]/5 p-6 rounded-xl hover:border-[#C5A059]/80 transition-all flex flex-col justify-between relative text-left">
            <span className="absolute -top-3 right-4 bg-[#C5A059] text-[8px] font-black uppercase px-2.5 py-1 rounded-full text-[#0A0A0B] tracking-wider font-mono">
              Save 17%
            </span>
            <div>
              <h3 className="text-base font-bold text-[#C5A059] mb-1 uppercase font-display">Yearly Ultimate</h3>
              <p className="text-zinc-500 text-[10px] mb-4">Uninterrupted pipeline engineering</p>
              <div className="text-3xl font-extrabold text-[#C5A059] mb-6 font-mono">
                $199.99<span className="text-xs font-normal text-zinc-500 font-mono">/yr</span>
              </div>
            </div>
            <button
              onClick={() => handleSubscribe("yearly")}
              disabled={loading !== null}
              className="w-full py-2.5 px-4 bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center"
            >
              {loading === "yearly" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Select Yearly"
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 pt-4 border-t border-[#27272A]/60 max-w-md mx-auto">
          <button 
            onClick={onLogout} 
            className="text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out of operator account
          </button>
        </div>
      </motion.div>
    </div>
  );
};
