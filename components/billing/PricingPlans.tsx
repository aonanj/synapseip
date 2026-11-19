"use client";

import { useMemo } from "react";

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

type PricingPlansProps = {
  plans: PricePlan[];
  onSubscribe: (priceId: string) => void;
};

function PricingCard({ plan, onSubscribe }: { plan: PricePlan; onSubscribe: (priceId: string) => void }) {
  const isBeta = plan.tier === "beta_tester";
  const isUser = plan.tier === "user";

  const price = useMemo(() => {
    return (plan.amount_cents / 100).toFixed(2);
  }, [plan.amount_cents]);

  const periodDisplay = useMemo(() => {
    if (plan.interval === "year") return "year (billed annually)";
    if (plan.interval === "month") {
      if (plan.interval_count === 1) return "month (billed monthly)";
      if (plan.interval_count === 3) return "3 months (billed quarterly)";
      return `${plan.interval_count} months`;
    }
    return plan.interval;
  }, [plan.interval, plan.interval_count]);

  const savings = useMemo(() => {
    // Calculate savings for yearly plan compared to monthly
    if (plan.tier === "user" && plan.interval === "year") {
      const monthlyEquivalent = 189 * 12; // $189/month * 12
      const yearlyCost = plan.amount_cents / 100;
      const saved = monthlyEquivalent - yearlyCost;
      const percentSaved = (saved / monthlyEquivalent) * 100;
      return { amount: saved, percent: percentSaved.toFixed(0) };
    }
    else if (plan.tier === "beta_tester" && plan.interval_count === 3) {
      const monthlyEquivalent = 189 * 12; // $189/month * 12
      const yearlyCost = (plan.amount_cents / 100) * 4;
      const saved = monthlyEquivalent - yearlyCost;
      const percentSaved = (saved / monthlyEquivalent) * 100;
      return { amount: saved, percent: percentSaved.toFixed(0) };
    }
    else if (plan.tier === "beta_tester" && plan.interval_count === 1) {
      const monthlyEquivalent = 189 * 12; // $189/month * 12
      const yearlyCost = (plan.amount_cents / 100) * 12;
      const saved = monthlyEquivalent - yearlyCost;
      const percentSaved = (saved / monthlyEquivalent) * 100;
      return { amount: saved, percent: percentSaved.toFixed(0) };
    }
    return null;
  }, [plan.tier, plan.interval, plan.amount_cents]);

  const recommended = plan.tier === "beta_tester" && plan.interval_count === 3;

  return (
    <div
      className={`relative bg-white rounded-xl border-2 shadow-sm transition-all ${
        recommended
          ? "border-sky-500 shadow-sky-100 scale-105"
          : "border-slate-200 hover:border-sky-300 hover:shadow-md"
      }`}
    >
      {/* Recommended Badge */}
      {recommended && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <span className="px-4 py-1 bg-sky-500 text-white text-xs font-bold rounded-full shadow-md">
            BEST VALUE
          </span>
        </div>
      )}

      <div className="p-6">
        {/* Tier Name */}
        <div className="mb-4">
          <h3 className="text-lg font-bold" style={{ color: '#102A43' }}>{isBeta ? "Early Adopter" : "Standard User"}</h3>
          <p className="text-sm text-slate-500 mt-1">
            {isBeta ? "Limited-time pricing" : "Full-featured access"}
          </p>
        </div>

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold" style={{ color: '#102A43' }}>${price}</span>
            <span className="text-slate-600">/ {periodDisplay}</span>
          </div>

          {savings && (
            <div className="mt-2">
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                Save ${savings.amount} ({savings.percent}% off)
              </span>
            </div>
          )}

        </div>

        {/* Features */}
        <ul className="space-y-3 mb-6">
          <li className="flex items-start gap-2 text-sm text-slate-700">
            <svg
              className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Unlimited searches</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-slate-700">
            <svg
              className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>AI-powered insights and metrics</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-slate-700">
            <svg
              className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Downloadable reports</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-slate-700">
            <svg
              className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Email alerts</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-slate-700">
            <svg
              className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>IP Overview</span>
          </li>
          {isBeta && (
            <li className="flex items-start gap-2 text-sm text-orange-700 font-semibold">
              <svg
                className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Early adopter pricing</span>
            </li>
          )}
        </ul>

        {/* Subscribe Button */}
        <button
          onClick={() => onSubscribe(plan.stripe_price_id)}
          className={`w-full px-4 py-3 rounded-lg font-semibold transition-colors ${
            recommended
              ? "bg-sky-500 text-white hover:bg-sky-600 shadow-md"
              : "bg-slate-100 text-[#102A43] hover:bg-slate-200 border border-slate-200"
          }`}
        >
          {isBeta ? "Get Early Adopter Plan" : "Subscribe Now"}
        </button>
      </div>
    </div>
  );
}

export default function PricingPlans({ plans, onSubscribe }: PricingPlansProps) {
  const betaPlans = useMemo(() => {
    return plans.filter((p) => p.tier === "beta_tester" && p.is_active);
  }, [plans]);

  const userPlans = useMemo(() => {
    return plans.filter((p) => p.tier === "user" && p.is_active);
  }, [plans]);

  if (plans.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No pricing plans available at this time.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#102A43' }}>Choose Your Plan</h2>
        <p className="text-lg text-slate-600">
          Get full access to all SynapseIP features
        </p>
      </div>

      {/* Beta Tier Plans */}
      {betaPlans.length > 0 && (
        <div className="mb-12">
          <h3 className="text-xl font-bold mb-4" style={{ color: '#102A43' }}>Early Adopter Access</h3>
          <p className="text-sm text-slate-600 mb-6">
            Special pricing for early adopters. Limited-time offer.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {betaPlans.map((plan) => (
              <PricingCard key={plan.stripe_price_id} plan={plan} onSubscribe={onSubscribe} />
            ))}
          </div>
        </div>
      )}

      {/* User Tier Plans */}
      {userPlans.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4" style={{ color: '#102A43' }}>Standard Access</h3>
          <p className="text-sm text-slate-600 mb-6">
            Full access to all features. Choose monthly or annual billing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {userPlans.map((plan) => (
              <PricingCard key={plan.stripe_price_id} plan={plan} onSubscribe={onSubscribe} />
            ))}
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className="mt-16 max-w-4xl mx-auto">
        <h3 className="text-2xl font-bold text-center mb-8" style={{ color: '#102A43' }}>
          What's Included
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="text-center p-4">
            <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>High-Accuracy Search</h4>
            <p className="text-sm text-slate-600">
              Search 83,000+ patents and applications with AI-powered insights and metrics.
            </p>
          </div>

          <div className="text-center p-4">
            <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>Trend Analysis</h4>
            <p className="text-sm text-slate-600">
              View AI/ML IP trends based on owner, tech domain, and timeline.
            </p>
          </div>

          <div className="text-center p-4">
            <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>Data Export</h4>
            <p className="text-sm text-slate-600">
              Export search results to CSV or PDF for further analysis.
            </p>
          </div>

          <div className="text-center p-4">
            <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>Email Alerts</h4>
            <p className="text-sm text-slate-600">
              Automatic email notifications when new patents or publications match saved search criteria.
            </p>
          </div>

          <div className="text-center p-4">
            <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v6a1 1 0 102 0V7zm-3 2a1 1 0 10-2 0v4a1 1 0 102 0V9zm-3 3a1 1 0 10-2 0v1a1 1 0 102 0v-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>IP Overview</h4>
            <p className="text-sm text-slate-600">
              Identify gaps in AI/ML IP coverage and innovation opportunities.
            </p>
          </div>

          <div className="text-center p-4">
            <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>Priority Support</h4>
            <p className="text-sm text-slate-600">
              Get help when you need it from our expert support team.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-16 max-w-2xl mx-auto">
        <h3 className="text-2xl font-bold text-center mb-8" style={{ color: '#102A43' }}>
          Frequently Asked Questions
        </h3>
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>Can I cancel anytime?</h4>
            <p className="text-sm text-slate-600">
              Yes, you can cancel your subscription at any time. You'll retain access until the end
              of your billing period.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>Are the Early Adopter plans still available?</h4>
            <p className="text-sm text-slate-600">
              Early Adopter plans are available as long as they are offered for purchase, but they may be removed at any time.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>Does the Early Adopter pricing expire?</h4>
            <p className="text-sm text-slate-600">
              Early Adopter pricing will be honored for at least 6 months after date of purchase, provided an active subscription is maintained during that time. Any pricing changes will be communicated at least 30 days in advance. Cancel any time.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>Do you offer refunds?</h4>
            <p className="text-sm text-slate-600">
              Please contact us at <a href="mailto:admin@phaethonorder.com" target="_blank" rel="noopener noreferrer" className="text-[#5FA8D2] font-medium hover:underline hover:text-[#ffa400]">
                admin@phaethonorder.com
              </a> if you have concerns about your subscription.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>Is my payment information secure?</h4>
            <p className="text-sm text-slate-600">
              Yes, all payments are processed securely through Stripe. No payment information is shared with us by Stripe.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: '#102A43' }}>Does SynapseIP offer other discounts or promo codes?</h4>
            <p className="text-sm text-slate-600">
              Discounts may be offered to select users. Please contact us at <a href="mailto:admin@phaethonorder.com" target="_blank" rel="noopener noreferrer" className="text-[#5FA8D2] font-medium hover:underline hover:text-[#ffa400]">
                admin@phaethonorder.com
              </a> for further information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
