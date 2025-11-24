"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState, useCallback, Suspense } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import SubscriptionStatus from "@/components/billing/SubscriptionStatus";
import PricingPlans from "@/components/billing/PricingPlans";

type SubscriptionInfo = {
  has_active: boolean;
  tier: string | null;
  status: string | null;
  days_in_tier: number | null;
  needs_migration: boolean;
  period_end: string | null;
  stripe_customer_id: string | null;
};

type PricePlan = {
  stripe_price_id: string;
  tier: string;
  name: string;
  amount_cents: number;
  currency: string;
  interval: string;
  interval_count: number;
  description: string | null;
  is_active: boolean;
};

const TEXT_COLOR = "#102A43";
const LINK_COLOR = "#5FA8D2";
const CARD_BG = "rgba(255, 255, 255, 0.8)";
const CARD_BORDER = "rgba(255, 255, 255, 0.45)";
const CARD_SHADOW = "0 26px 54px rgba(15, 23, 42, 0.28)";

const pageWrapperStyle: CSSProperties = {
  padding: "48px 24px 64px",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 32,
  color: TEXT_COLOR,
};

const surfaceStyle: CSSProperties = {
  maxWidth: 1240,
  width: "100%",
  margin: "0 auto",
  display: "grid",
  gap: 24,
  padding: 32,
  borderRadius: 28,
};

const cardBaseStyle: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 20,
  padding: 32,
  boxShadow: CARD_SHADOW,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const successCardStyle: CSSProperties = {
  ...cardBaseStyle,
  background: "rgba(16, 185, 129, 0.16)",
  border: "1px solid rgba(34, 197, 94, 0.45)",
  boxShadow: "0 24px 44px rgba(34, 197, 94, 0.28)",
};

const errorCardStyle: CSSProperties = {
  ...cardBaseStyle,
  background: "rgba(248, 113, 113, 0.18)",
  border: "1px solid rgba(239, 68, 68, 0.45)",
  boxShadow: "0 24px 44px rgba(239, 68, 68, 0.22)",
};

const actionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 28px",
  borderRadius: 999,
  background: "linear-gradient(105deg, #5FA8D2 0%, #39506B 100%)",
  color: "#ffffff",
  fontWeight: 600,
  fontSize: 14,
  border: "1px solid rgba(107, 174, 219, 0.55)",
  boxShadow: "0 18px 36px rgba(107, 174, 219, 0.55)",
  cursor: "pointer",
  transition: "transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease",
};

const footerStyle: CSSProperties = {
  alignSelf: "center",
  padding: "16px 24px",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.22)",
  border: "1px solid rgba(255, 255, 255, 0.35)",
  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.26)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  color: "#102a43",
  textAlign: "center",
  fontSize: 13,
  fontWeight: 500,
  gap: 4,
};

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function BillingContent() {
  const { isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently, user } = useAuth0();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<PricePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSubscriptionStatus = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE}/api/payment/subscription-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load subscription: ${response.status}`);
      }

      const data = await response.json();
      setSubscription(data);
    } catch (err: any) {
      console.error("Error loading subscription:", err);
      setError(err.message || "Failed to load subscription status");
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  const loadPricingPlans = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/payment/pricing-plans`);

      if (!response.ok) {
        throw new Error(`Failed to load pricing: ${response.status}`);
      }

      const data = await response.json();
      setPlans(data.plans || []);
    } catch (err: any) {
      console.error("Error loading pricing:", err);
      setError(err.message || "Failed to load pricing plans");
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        isAuthenticated ? loadSubscriptionStatus() : Promise.resolve(),
        loadPricingPlans(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, loadSubscriptionStatus, loadPricingPlans]);

  useEffect(() => {
    if (!isLoading) {
      loadData();
    }
  }, [isLoading, loadData]);

  // Handle successful checkout
  useEffect(() => {
    if (sessionId && isAuthenticated) {
      setSuccessMessage("Subscription created successfully! Processing payment...");
      // Reload subscription status after a short delay (webhook might take a moment)
      const timer = setTimeout(() => {
        loadSubscriptionStatus();
        setSuccessMessage("Subscription activated successfully!");
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [sessionId, isAuthenticated, loadSubscriptionStatus]);

  const handleSubscribe = useCallback(
    async (priceId: string) => {
      if (!isAuthenticated) {
        loginWithRedirect();
        return;
      }

      if (!user?.email) {
        alert("Email not found in user profile. Please log out and log in again.");
        return;
      }

      try {
        const token = await getAccessTokenSilently();
        const response = await fetch(`${API_BASE}/api/payment/create-checkout-session`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            price_id: priceId,
            email: user.email,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const { url } = await response.json();
        window.location.href = url;
      } catch (err: any) {
        console.error("Error creating checkout session:", err);
        alert(err.message || "Failed to start checkout process");
      }
    },
    [isAuthenticated, getAccessTokenSilently, loginWithRedirect, user]
  );

  const handleManageSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      loginWithRedirect();
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE}/api/payment/create-portal-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err: any) {
      console.error("Error opening customer portal:", err);
      alert(err.message || "Failed to open customer portal");
    }
  }, [isAuthenticated, getAccessTokenSilently, loginWithRedirect]);

  if (isLoading || loading) {
    return (
      <div style={pageWrapperStyle}>
        <div className="glass-surface" style={surfaceStyle}>
          <div className="glass-card" style={{ ...cardBaseStyle, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-500 border-r-transparent"></div>
            <p style={{ marginTop: 16, fontSize: 14, color: TEXT_COLOR }}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={pageWrapperStyle}>
        <div className="glass-surface" style={surfaceStyle}>
          <div className="glass-card" style={{ ...cardBaseStyle, textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: TEXT_COLOR }}>Sign in to Continue</h2>
            <p style={{ marginTop: 12, fontSize: 14, color: "#627D98" }}>
              Please log in to view your subscription or purchase a plan.
            </p>
            <button
              onClick={() => loginWithRedirect()}
              style={{ ...actionButtonStyle, width: "100%", justifyContent: "center", marginTop: 24 }}
            >
              Log in / Sign up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={surfaceStyle}>

        {/* Header */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>Billing & Subscription</h1>
          <p style={{ marginTop: 16, fontSize: 15, lineHeight: 1.6, color: "#627D98", marginBottom: 0 }}>
            Manage your SynapseIP subscription, review billing status, and update payment preferences.
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="glass-card" style={successCardStyle}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#14532d" }}>{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="glass-card" style={errorCardStyle}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#7f1d1d" }}>{error}</p>
            <button
              onClick={loadData}
              style={{ ...actionButtonStyle, marginTop: 16 }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Subscription or Pricing */}
        {subscription?.has_active ? (
          <div className="glass-card" style={{ ...cardBaseStyle }}>
            <SubscriptionStatus
              subscription={subscription}
              onManage={handleManageSubscription}
              accountEmail={user?.email || null}
            />
          </div>
        ) : (
          <div className="glass-card" style={{ ...cardBaseStyle }}>
            <PricingPlans plans={plans} onSubscribe={handleSubscribe} />
          </div>
        )}

        {/* Support Info */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR }}>Billing & Technical Support</h2>
          <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: TEXT_COLOR }}>
            For subscription, billing, and technical issues, contact <strong><a href="mailto:support@phaethon.llc" style={{ color: LINK_COLOR, textDecoration: "none" }}>support@phaethon.llc</a></strong>.
          </p>
          <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: TEXT_COLOR }}>
            For urgent issues, phone and text support are available at <strong>(949) 326-0878</strong>. Please include your account email so we can assist quickly.
          </p>
          <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: TEXT_COLOR, marginBottom: 0 }}>
            Phone and text support require an active subscription.
          </p>
        </div>
      </div>
      <div className="glass-surface" style={surfaceStyle}>
        <footer style={footerStyle}>
          2025 © Phaethon Order LLC | <a href="mailto:support@phaethon.llc" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">support@phaethon.llc</a> | <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">phaethonorder.com</a> | <a href="/help" className="text-[#312f2f] hover:underline hover:text-blue-400">Help</a> | <a href="/docs" className="text-[#312f2f] hover:underline hover:text-blue-400">Legal</a>
        </footer>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div style={pageWrapperStyle}>
        <div className="glass-surface" style={surfaceStyle}>
          <div className="glass-card" style={{ ...cardBaseStyle, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-500 border-r-transparent"></div>
            <p style={{ marginTop: 16, fontSize: 14, color: TEXT_COLOR }}>Loading...</p>
          </div>
        </div>
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
