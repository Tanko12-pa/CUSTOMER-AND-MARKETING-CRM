import React, { useState } from "react";
import { motion } from "motion/react";

interface PaywallProps {
  userEmail: string;
  onLogout: () => void;
}

export const SubscriptionPaywall: React.FC<PaywallProps> = ({ userEmail, onLogout }) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceType: "monthly" | "yearly") => {
    setLoading(priceType);
    try {
      const response = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, priceType }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect directly to Stripe Secure Checkout
      } else {
        alert("Failed to initiate subscription check out sequence.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4 text-white font-sans" id="subscription-paywall-screen">
      <motion.div 
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center"
      >
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-amber-400 font-bold text-2xl">⏳</span>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight mb-2">Your 7-Day Free Trial Has Expired</h2>
        <p className="text-slate-400 max-w-md mx-auto mb-8 text-sm leading-relaxed">
          To maintain secure operator dashboard telemetry access and execute growth modules, choose a structured subscription tier below.
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
          {/* Monthly Tier Card */}
          <div className="border border-slate-800 bg-slate-900/50 p-6 rounded-xl hover:border-violet-500/50 transition-all flex flex-col justify-between text-left">
            <div>
              <h3 className="text-xl font-bold mb-1 header">Monthly License</h3>
              <p className="text-slate-500 text-xs mb-4">Flexible deployment cycle</p>
              <div className="text-3xl font-black text-white mb-6">$19.99<span className="text-sm font-normal text-slate-400">/mo</span></div>
            </div>
            <button
              onClick={() => handleSubscribe("monthly")}
              disabled={loading !== null}
              className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading === "monthly" ? "Loading Gateway..." : "Select Monthly"}
            </button>
          </div>

          {/* Yearly Tier Card */}
          <div className="border border-violet-500/30 bg-violet-950/10 p-6 rounded-xl hover:border-violet-500/60 transition-all flex flex-col justify-between relative text-left">
            <span className="absolute -top-3 right-4 bg-violet-600 text-[10px] uppercase font-black px-2.5 py-1 rounded-full text-white tracking-wider">Best Value</span>
            <div>
              <h3 className="text-xl font-bold mb-1">Yearly Enterprise</h3>
              <p className="text-slate-500 text-xs mb-4">Uninterrupted pipeline engineering</p>
              <div className="text-3xl font-black text-white mb-6">$199.99<span className="text-sm font-normal text-slate-400">/yr</span></div>
            </div>
            <button
              onClick={() => handleSubscribe("yearly")}
              disabled={loading !== null}
              className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading === "yearly" ? "Loading Gateway..." : "Select Yearly"}
            </button>
          </div>
        </div>

        <button onClick={onLogout} className="text-xs text-slate-500 hover:text-slate-400 underline transition-colors cursor-pointer">
          Sign out of console account
        </button>
      </motion.div>
    </div>
  );
};
