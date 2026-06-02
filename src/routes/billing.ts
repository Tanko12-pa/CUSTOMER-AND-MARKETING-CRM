import { Router } from "express";
import Stripe from "stripe";

const router = Router();
const stripeKey = process.env.STRIPE_SECRET_KEY || "sk_test_mock_secret_key_placeholder";
const stripe = new Stripe(stripeKey, {
  apiVersion: "2023-10-16" as any,
});

// Mock database user update helper
const usersDb = new Map<string, any>();

// Registration Route with a 7-day Free Trial timestamp
router.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7); // Calculate 7 days out

  const newUser = {
    id: "_" + Math.random().toString(36).substr(2, 9),
    name,
    email,
    password, // Use hashing in real production applications
    trialEndsAt: trialEndsAt.toISOString(),
    subscriptionStatus: "trialing", // trialing, active, canceled, incomplete
    stripeCustomerId: null,
  };

  usersDb.set(email, newUser);
  return res.status(201).json({ message: "User registered successfully!", user: newUser });
});

// Seed user for testing
const initialTrialEnds = new Date();
initialTrialEnds.setDate(initialTrialEnds.getDate() + 7);
usersDb.set("operator@company.com", {
  id: "seed_trial_1",
  name: "CRM Operator",
  email: "operator@company.com",
  password: "admin_password_999",
  trialEndsAt: initialTrialEnds.toISOString(),
  subscriptionStatus: "trialing",
  stripeCustomerId: null
});

// Sign-in handler
router.post("/api/auth/signin", async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = usersDb.get(cleanEmail);

  // 1. First, strictly verify if the user exists
  if (!user) {
    return res.status(401).json({ error: "Incorrect email or password. Please try again or reset your password." });
  }

  // 2. Verify password integrity (direct match since it is testing and is stored in usersDb)
  const isPasswordValid = password === user.password;
  if (!isPasswordValid) {
    return res.status(401).json({ error: "Incorrect email or password. Please try again or reset your password." });
  }

  // 3. DO NOT block login if the trial is expired or subscription is missing! 
  // Pass the data to the frontend so the Paywall component can handle the redirection cleanly.
  return res.status(200).json({
    message: "Authenticated successfully",
    user: {
      name: user.name,
      email: user.email,
      trialEndsAt: user.trialEndsAt, // Ensure this field is always sent back
      subscriptionStatus: user.subscriptionStatus || "trialing" 
    }
  });
});


// Stripe Checkout Session Creation Route
router.post("/api/billing/create-checkout", async (req, res) => {
  const { email, priceType } = req.body; // priceType: 'monthly' or 'yearly'
  const user = usersDb.get(email);

  if (!user) return res.status(404).json({ error: "User not found." });

  const PRICE_IDS = {
    monthly: "Price_1Tbx1IBMbxh6jv0CzuXwdDlD",
    yearly: "Price_1Tbx3YBMbxh6jv0CXeWxuVSf"
  };

  try {
    // Create customer if it doesn't exist yet
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
    }

    const appUrl = process.env.APP_URL || (req.get("origin") || `${req.protocol}://${req.get("host")}`);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: PRICE_IDS[priceType as keyof typeof PRICE_IDS], quantity: 1 }],
      mode: "subscription",
      success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing-portal`,
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
