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

// ─── Design tokens (dark-gold CRM aesthetic from screenshots) ────────────────
const C = {
  bg:      "#1a1a1a",
  surface: "#242424",
  card:    "#1f1f1f",
  border:  "#333333",
  gold:    "#c8922a",       // primary accent
  goldBtn: "#c8922a",
  text:    "#f0ede6",
  muted:   "#888880",
  danger:  "#d94f3d",       // red used in screenshot error banners
  success: "#4caf70",
  input:   "#2a2a2a",
  inputBorder: "#3a3a3a",
};

// ─── Shared style objects with explicit types for TS ──────────────────────────
const S: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Courier New', 'Courier', monospace",
    padding: "1rem",
  },
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    padding: "2.4rem 2rem",
    width: 480,
    maxWidth: "100%",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
  },
  title: {
    fontFamily: "'Georgia', serif",
    fontSize: 26,
    fontWeight: 700,
    color: C.text,
    textAlign: "center",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: C.gold,
    textAlign: "center",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    marginBottom: "1.6rem",
  },
  rule: {
    border: "none",
    borderTop: `1px solid ${C.border}`,
    margin: "0 0 1.4rem",
  },
  bullet: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontSize: 13,
    color: C.text,
    marginBottom: 10,
    lineHeight: 1.55,
  },
  bulletIcon: { fontSize: 16, marginTop: 1, flexShrink: 0 },
  label: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: 5,
    marginTop: 2,
    fontFamily: "'Courier New', monospace",
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: C.input,
    border: `1px solid ${C.inputBorder}`,
    borderRadius: 4,
    padding: "0 12px",
    marginBottom: "1.1rem",
  },
  inputIcon: { fontSize: 15, color: C.muted, flexShrink: 0 },
  inputEl: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: C.text,
    fontSize: 14,
    padding: "11px 0",
    fontFamily: "'Courier New', monospace",
  },
  errBanner: {
    background: "rgba(180,40,30,0.18)",
    border: `1px solid ${C.danger}`,
    borderRadius: 4,
    padding: "12px 16px",
    fontSize: 12,
    color: C.danger,
    textAlign: "center",
    lineHeight: 1.65,
    marginBottom: "1.2rem",
    fontFamily: "'Courier New', monospace",
    letterSpacing: "0.01em",
  },
  okBanner: {
    background: "rgba(76,175,112,0.15)",
    border: `1px solid ${C.success}`,
    borderRadius: 4,
    padding: "10px 14px",
    fontSize: 12,
    color: C.success,
    marginBottom: "1rem",
    textAlign: "center",
    fontFamily: "'Courier New', monospace",
  },
  btnGold: {
    width: "100%",
    padding: "13px",
    borderRadius: 4,
    border: "none",
    background: C.goldBtn,
    color: "#111",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnDark: {
    width: "100%",
    padding: "13px",
    borderRadius: 4,
    border: `1px solid ${C.border}`,
    background: "#2a2a2a",
    color: C.text,
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerRow: {
    textAlign: "center",
    fontSize: 12,
    color: C.muted,
    marginTop: 6,
    fontFamily: "'Courier New', monospace",
  },
  link: { color: C.gold, cursor: "pointer", fontWeight: 700 },
  forgotRow: {
    textAlign: "right",
    marginTop: -8,
    marginBottom: "1rem",
    fontSize: 11,
    color: C.gold,
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    letterSpacing: "0.05em",
  },
};

export function SubscriptionGate({
  onRegisterTrial,
  onLogin,
  onSelectPlan,
  currentUser,
  checkoutSimulated,
  onConfirmSimulatedSubscription,
  loading,
}: SubscriptionGateProps) {
  const [mode, setMode] = useState<"signUp" | "signIn" | "forgotPassword">("signUp");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [forgotEmailSent, setForgotEmailSent] = useState(false);

  // Credit Card inputs for simulated Stripe screen
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/29");
  const [cardCvc, setCardCvc] = useState("123");
  const [cardName, setCardName] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Helper to clear error
  const clearError = () => {
    if (errorText) setErrorText("");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");

    if (!name.trim()) return setErrorText("Full name is required.");
    if (!email.trim()) return setErrorText("Email address is required.");
    if (!password) return setErrorText("Password is required.");
    if (password.length < 6) return setErrorText("Password must be at least 6 characters.");

    setLocalLoading(true);
    try {
      await registerWithTrial(name, email, password);
      // Success will update root observer
    } catch (err: any) {
      if (err.message?.includes("email-already-in-use") || err.code === "auth/email-already-in-use" || err.message?.includes("already-in-use")) {
        setErrorText("An account with this email already exists. Please click 'Sign In' below to access your trial.");
      } else {
        setErrorText(err.message || "An authentication error occurred.");
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");

    if (!email.trim() || !password) {
      return setErrorText("Please enter your email and password.");
    }

    setLocalLoading(true);
    try {
      await signInAndCheckTrial(email, password);
    } catch (err: any) {
      if (err.message?.includes("invalid-credential") || err.code === "auth/invalid-credential" || err.message?.includes("wrong-password") || err.message?.includes("user-not-found")) {
        setErrorText("Incorrect email or password. Please try again or reset your password.");
      } else {
        setErrorText(err.message || "An authentication error occurred.");
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");
    if (!email.trim()) {
      return setErrorText("Please enter your email address first.");
    }

    setLocalLoading(true);
    try {
      await resetUserPassword(email);
      setForgotEmailSent(true);
    } catch (err: any) {
      setErrorText(err.message || "An authentication anomaly occurred.");
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSimulatedPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutSimulated) return;
    setPaymentLoading(true);
    setErrorText("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await onConfirmSimulatedSubscription(checkoutSimulated.email, checkoutSimulated.plan);
    } catch (err: any) {
      setErrorText(err.message || "Payment processing error.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const isAuthLoading = loading || localLoading;

  // 1. Stripe simulated checkout view
  if (checkoutSimulated) {
    const isMonthly = checkoutSimulated.plan === "monthly";
    const amountStr = isMonthly ? "$19.99 / month" : "$199.99 / year";

    return (
      <div style={S.page} id="stripe-sim-screen">
        <div style={S.card}>
          <div style={S.title}>Secure Stripe Sandbox</div>
          <div style={S.subtitle}>Stripe Checkout simulation</div>
          <hr style={S.rule} />

          <div style={{
            background: "#0A0A0B",
            padding: "1rem",
            borderRadius: 4,
            border: `1px solid ${C.border}`,
            marginBottom: "1.2rem",
            fontFamily: "'Courier New', monospace",
            fontSize: 12
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: C.muted }}>PRODUCT:</span>
              <strong style={{ color: C.text }}>CRM Pro {isMonthly ? "Monthly" : "Yearly"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: C.muted }}>BILLING EMAIL:</span>
              <span style={{ color: C.text, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 220 }} title={checkoutSimulated.email}>
                {checkoutSimulated.email}
              </span>
            </div>
            <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: "bold" }}>
              <span style={{ color: C.gold }}>TOTAL DUE:</span>
              <span style={{ color: C.text }}>{amountStr}</span>
            </div>
          </div>

          {errorText && <div style={S.errBanner}>{errorText}</div>}

          <form onSubmit={handleSimulatedPayment} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <div>
              <div style={S.label}>Cardholder Name</div>
              <div style={S.inputWrap}>
                <span style={S.inputIcon}>👤</span>
                <input
                  type="text"
                  required
                  placeholder="Akindewum"
                  value={cardName}
                  style={S.inputEl}
                  onChange={(e) => {
                    setCardName(e.target.value);
                    clearError();
                  }}
                />
              </div>
            </div>

            <div>
              <div style={S.label}>Card Details</div>
              <div style={S.inputWrap}>
                <span style={S.inputIcon}>💳</span>
                <input
                  type="text"
                  required
                  value={cardNumber}
                  style={S.inputEl}
                  onChange={(e) => {
                    setCardNumber(e.target.value);
                    clearError();
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={S.inputWrap}>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="MM/YY"
                    value={cardExpiry}
                    style={{ ...S.inputEl, textAlign: "center" }}
                    onChange={(e) => {
                      setCardExpiry(e.target.value);
                      clearError();
                    }}
                  />
                </div>
                <div style={S.inputWrap}>
                  <input
                    type="password"
                    required
                    maxLength={3}
                    placeholder="CVC"
                    value={cardCvc}
                    style={{ ...S.inputEl, textAlign: "center" }}
                    onChange={(e) => {
                      setCardCvc(e.target.value);
                      clearError();
                    }}
                  />
                </div>
              </div>
            </div>

            <button type="submit" style={S.btnGold} disabled={paymentLoading}>
              {paymentLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Authorize Payment {isMonthly ? "$19.99" : "$199.99"}</span>
                </>
              )}
            </button>
          </form>

          <p style={{ fontSize: 10, color: C.muted, textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
            🛡️ Encrypted via Stripe SSL. All payment configurations are executed server-side.
          </p>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 9,
            color: C.muted,
            background: "#0A0A0B",
            border: `1px solid ${C.inputBorder}`,
            padding: "6px 10px",
            borderRadius: 4,
            width: "100%",
            fontFamily: "'Courier New', monospace",
            marginTop: 12,
            userSelect: "all"
          }}>
            <span>💳 KEY:</span>
            <span style={{ color: C.text, fontWeight: "bold", opacity: 0.8 }} title="Stripe Live Publishable Key">
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
      <div style={S.page} id="subscription-renewal-wall">
        <div style={S.card}>
          <div style={S.title}>Customer &amp; Marketing CRM</div>
          <div style={S.subtitle}>Executive Revenue Intelligence Gate</div>
          <hr style={S.rule} />

          <div style={{ ...S.errBanner, marginBottom: "1.2rem" }}>
            ⚠ Your 7-day free trial has expired. Subscribe to continue.
          </div>
          <div style={{ ...S.title, fontSize: 18, marginBottom: "1rem" }}>Choose Your Plan</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {/* Monthly Option */}
            <div
              onClick={() => onSelectPlan("monthly")}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: "1rem",
                cursor: "pointer",
                background: "transparent",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.gold;
                e.currentTarget.style.background = "rgba(197,160,89,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text, fontFamily: "'Courier New', monospace" }}>Monthly Plan</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: "'Courier New', monospace" }}>Billed monthly · Cancel anytime</div>
              </div>
              <div style={{ textAlign: "right", fontFamily: "'Courier New', monospace" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>$19.99 / mo</div>
              </div>
            </div>

            {/* Yearly Option */}
            <div
              onClick={() => onSelectPlan("yearly")}
              style={{
                border: `2px solid ${C.gold}`,
                borderRadius: 4,
                padding: "1rem",
                cursor: "pointer",
                background: "rgba(197,160,89,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "relative"
              }}
            >
              <div style={{
                position: "absolute",
                top: 0,
                right: 12,
                transform: "translateY(-50%)",
                background: C.gold,
                color: "#111",
                fontSize: 8,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 3,
                letterSpacing: "0.08em"
              }}>
                BEST VALUE
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text, fontFamily: "'Courier New', monospace" }}>Yearly Plan</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: "'Courier New', monospace" }}>Save 17% · Best enterprise value</div>
              </div>
              <div style={{ textAlign: "right", fontFamily: "'Courier New', monospace" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.gold }}>$199.99 / yr</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button style={{ ...S.btnDark, marginBottom: 0 }} onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.reload();
              } catch (e) {}
            }}>
              Log Out of Account
            </button>
          </div>
          <div style={{ fontSize: 10, color: C.muted, textAlign: "center", lineHeight: 1.6, marginTop: 12 }}>
            Secure payment · Cancel anytime · Full CRM pipeline access included
          </div>
        </div>
      </div>
    );
  }

  // 3. Forgot Password view
  if (mode === "forgotPassword") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.title}>Customer &amp; Marketing CRM</div>
          <div style={S.subtitle}>Executive Revenue Intelligence Gate</div>
          <hr style={S.rule} />

          <div style={{ ...S.title, fontSize: 18, marginBottom: 4 }}>Reset Password</div>
          <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: "1.2rem", lineHeight: 1.6 }}>
            Update your account credentials. Enter your email below to dispatch a recovery link.
          </div>

          {errorText && <div style={S.errBanner}>{errorText}</div>}
          {forgotEmailSent && (
            <div style={S.okBanner}>
              A secure password reset link has been dispatched to {email}.
            </div>
          )}

          <form onSubmit={handleForgotPasswordSubmit} style={{ display: "flex", flexDirection: "column" }}>
            <div style={S.label}>Email Address</div>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}>✉</span>
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                style={S.inputEl}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
              />
            </div>

            <button type="submit" style={S.btnGold} disabled={isAuthLoading}>
              {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <span>Dispatch Reset Link →</span>}
            </button>
            <button type="button" style={S.btnDark} onClick={() => { setMode("signIn"); setErrorText(""); setForgotEmailSent(false); }}>
              ← Go Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 4. Registration view
  if (mode === "signUp") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.title}>Customer &amp; Marketing CRM</div>
          <div style={S.subtitle}>Executive Revenue Intelligence Gate</div>
          <hr style={S.rule} />

          <div style={S.bullet}>
            <span style={S.bulletIcon}>🛡</span>
            <span>
              <strong>Subscription Protected Suite</strong>: All users can access and
              evaluate the platform through our official trial &amp; sub channels.
            </span>
          </div>
          <div style={S.bullet}>
            <span style={S.bulletIcon}>⚡</span>
            <span>
              <strong>100% Free Trial</strong>: Enjoy 7 full days of enterprise pipeline
              diagnostics before selecting an upgrade module.
            </span>
          </div>
          <hr style={{ ...S.rule, marginTop: "1rem" }} />

          {errorText && <div style={S.errBanner}>{errorText}</div>}

          <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column" }}>
            <div style={S.label}>Full Name</div>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}>👤</span>
              <input
                type="text"
                required
                placeholder="Your full name"
                value={name}
                style={S.inputEl}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError();
                }}
              />
            </div>

            <div style={S.label}>Email Address</div>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}>✉</span>
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                style={S.inputEl}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
              />
            </div>

            <div style={S.label}>Password</div>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}>🔒</span>
              <input
                type="password"
                required
                placeholder="Min. 8 characters"
                value={password}
                style={S.inputEl}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
              />
            </div>

            <button type="submit" style={S.btnGold} disabled={isAuthLoading}>
              {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <span>Start 7-Day Free Trial →</span>}
            </button>

            <div style={S.footerRow}>
              Already registered?{" "}
              <span style={S.link} onClick={() => { setMode("signIn"); setErrorText(""); }}>Sign In</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 5. Sign In view
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.title}>Customer &amp; Marketing CRM</div>
        <div style={S.subtitle}>Executive Revenue Intelligence Gate</div>
        <hr style={S.rule} />

        <div style={S.bullet}>
          <span style={S.bulletIcon}>🛡</span>
          <span>
            <strong>Subscription Protected Suite</strong>: All users can access and
            evaluate the platform through our official trial &amp; sub channels.
          </span>
        </div>
        <div style={S.bullet}>
          <span style={S.bulletIcon}>⚡</span>
          <span>
            <strong>100% Free Trial</strong>: Enjoy 7 full days of enterprise pipeline
            diagnostics before selecting an upgrade module.
          </span>
        </div>
        <hr style={{ ...S.rule, marginTop: "1rem" }} />

        {errorText && <div style={S.errBanner}>{errorText}</div>}

        <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column" }}>
          <div style={S.label}>Email Address</div>
          <div style={S.inputWrap}>
            <span style={S.inputIcon}>✉</span>
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              style={S.inputEl}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
              }}
            />
          </div>

          <div style={S.label}>Password</div>
          <div style={S.inputWrap}>
            <span style={S.inputIcon}>🔒</span>
            <input
              type="password"
              required
              placeholder="Your password"
              value={password}
              style={S.inputEl}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
            />
          </div>

          <div style={S.forgotRow} onClick={() => { setMode("forgotPassword"); setErrorText(""); setForgotEmailSent(false); }}>
            Forgot Password?
          </div>

          <button type="submit" style={S.btnDark} disabled={isAuthLoading}>
            {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <span>Sign In &amp; Continue Trial →</span>}
          </button>

          <div style={S.footerRow}>
            First time visitor evaluating CRM?{" "}
            <span style={S.link} onClick={() => { setMode("signUp"); setErrorText(""); }}>Register Free Trial</span>
          </div>
        </form>
      </div>
    </div>
  );
}
