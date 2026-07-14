import React, { useState } from 'react';
import { ShieldCheck, Download, Zap, Star, ArrowLeft, Loader2, Sparkles, CheckCircle2, Ticket, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { QRCodeCanvas } from 'qrcode.react';

export default function Subscription({ onBack }) {
  const { user, token } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState({ show: false, orderId: '', plan: '', amount: 0 });
  const [successMsg, setSuccessMsg] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const PLAN_TIERS = [
    {
      name: 'Free',
      price: '₹0',
      period: 'forever',
      description: 'Perfect for casual single-use viewers checking out the platform.',
      icon: Ticket,
      features: [
        'Strictly limited to 1 video download per day',
        'Standard Watch Party joining capabilities',
        'Standard HTML5 Player controls',
        'Ad-supported experience'
      ],
      current: user?.subscriptionPlan === 'Free',
      cta: 'Current Plan',
      ctaClass: 'bg-slate-100 text-slate-400 dark:bg-slate-900 cursor-not-allowed border border-slate-200 dark:border-slate-800'
    },
    {
      name: 'Bronze',
      price: '₹199',
      period: 'month',
      description: 'Unlock daily flexibility for small groups and downloads.',
      icon: Zap,
      features: [
        'Scaled limit: 5 video downloads per day',
        'Ad-free Watch Parties',
        'Custom location privacy mask options',
        'Standard group video/audio calls'
      ],
      current: user?.subscriptionPlan === 'Bronze',
      cta: 'Upgrade to Bronze',
      ctaClass: 'btn-premium from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/10 hover:shadow-amber-500/20'
    },
    {
      name: 'Silver',
      price: '₹499',
      period: 'month',
      description: 'Ideal for movie buffs and power watchers download queues.',
      icon: Star,
      features: [
        'Scaled limit: 15 video downloads per day',
        'Unrestricted watch room hosting power',
        'Full HD playback sync capabilities',
        'Priority peer connection routing'
      ],
      current: user?.subscriptionPlan === 'Silver',
      cta: 'Upgrade to Silver',
      ctaClass: 'btn-premium from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-purple-500/10 hover:shadow-purple-500/20'
    },
    {
      name: 'Gold',
      price: '₹999',
      period: 'month',
      description: 'The ultimate streaming experience with infinite downloads.',
      icon: Sparkles,
      features: [
        'Massive limit: 100 video downloads per day',
        'Official Gold member badge in chat',
        '24/7 dedicated watch room support',
        'VIP access to seeded high-bitrate films'
      ],
      current: user?.subscriptionPlan === 'Gold',
      cta: 'Upgrade to Gold',
      ctaClass: 'btn-premium from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 shadow-yellow-500/10 hover:shadow-yellow-500/20'
    }
  ];

  // Helper to load Razorpay checkout script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async (plan) => {
    setLoading(true);
    setSuccessMsg(null);

    try {
      // 1. Create order on backend
      const res = await fetch(`${API_BASE}/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      const orderData = await res.json();

      if (!orderData.success) {
        alert('Failed to initiate order.');
        setLoading(false);
        return;
      }

      // 2. Check if we need to load mock checkout modal or actual Razorpay
      if (orderData.isMock) {
        // Trigger simulated checkout popup
        setCheckoutModal({
          show: true,
          orderId: orderData.orderId,
          plan,
          amount: orderData.amount / 100
        });
        setLoading(false);
      } else {
        // Run full Razorpay checkout
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) {
          alert('Razorpay SDK failed to load. Are you connected to the internet?');
          setLoading(false);
          return;
        }

        const options = {
          key: orderData.key,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'watch party',
          description: `Upgrade user to ${plan} Tier`,
          order_id: orderData.orderId,
          handler: async (response) => {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan
            });
          },
          prefill: {
            name: user.username,
            email: user.email
          },
          theme: {
            color: '#8b5cf6'
          }
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
        setLoading(false);
      }

    } catch (err) {
      alert('Network exception occurred initializing payment gateway.');
      setLoading(false);
    }
  };

  // Callback to verify payments and update profiles
  const verifyPayment = async (payload) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg({
          plan: payload.plan,
          invoiceFilename: data.invoiceFilename,
          message: data.message
        });
        
        // Reload user details (trigger AuthContext update)
        window.location.reload();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Verification request failed.');
    } finally {
      setLoading(false);
    }
  };

  // Mock Success Action Handler
  const handleMockSuccess = async () => {
    setCheckoutModal(prev => ({ ...prev, show: false }));
    const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(2, 12)}`;
    // Signature simulation logic matches route requirement
    const mockSig = 'mock-signature-placeholder';
    
    await verifyPayment({
      razorpay_order_id: checkoutModal.orderId,
      razorpay_payment_id: mockPaymentId,
      razorpay_signature: mockSig,
      plan: checkoutModal.plan
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-6 animate-fade-in">
      {/* Back nav */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 mb-6 text-sm font-semibold transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      {/* Subscription upgrade success card */}
      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl flex flex-col gap-4 text-green-700 dark:text-green-400 mb-8 max-w-2xl mx-auto animate-scale-up">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-8 h-8 shrink-0 text-green-500" />
            <div>
              <h3 className="font-bold text-lg mb-1">Upgrade Successful!</h3>
              <p className="text-sm">{successMsg.message}</p>
              <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-2 font-mono">
                An invoice has been sent to your registered email. A local copy was saved to:
                <br />
                <span className="bg-white/50 dark:bg-slate-900/50 px-2 py-0.5 rounded border border-green-500/10 inline-block mt-1">
                  /server/invoices/${successMsg.invoiceFilename}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header title */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-2">
          <Zap className="w-8 h-8 text-brand-500" />
          <span>Subscription Plans & Tiers</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-xl mx-auto">
          Gain additional streaming speeds, unlock daily download guardrails, and secure your location privacy mask settings.
        </p>
      </div>

      {/* Pricing card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {PLAN_TIERS.map((tier) => {
          const Icon = tier.icon;
          return (
            <div 
              key={tier.name}
              className={`p-6 rounded-2xl flex flex-col justify-between border shadow-sm transition-all duration-300 relative ${
                tier.current 
                  ? 'bg-brand-500/5 dark:bg-brand-900/10 border-brand-500 ring-2 ring-brand-500/20 scale-[1.02]' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-850 hover:shadow-lg'
              }`}
            >
              {tier.current && (
                <span className="absolute -top-3 right-6 bg-brand-500 text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full shadow-sm">
                  Active
                </span>
              )}

              <div>
                {/* Icon & Name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl ${tier.current ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-900 text-brand-500'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{tier.name}</h3>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 min-h-[40px]">
                  {tier.description}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">{tier.price}</span>
                  <span className="text-xs text-slate-400">/{tier.period}</span>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 dark:border-slate-700/50 my-4" />

                {/* Feature checklist */}
                <ul className="flex flex-col gap-3 mb-8">
                  {tier.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                      <ShieldCheck className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleUpgrade(tier.name)}
                disabled={tier.current || tier.name === 'Free' || loading}
                className={`w-full py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                  tier.current || tier.name === 'Free' 
                    ? tier.ctaClass 
                    : `${tier.ctaClass} text-white hover:scale-[1.02] active:scale-95`
                }`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{tier.cta}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Mock checkout dialog modal popup */}
      {checkoutModal.show && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-750 pb-4 mb-4">
              <Zap className="w-6 h-6 text-brand-500 animate-pulse" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                Razorpay Checkout (Simulated Gateway)
              </h3>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              We detected that Razorpay credentials are not configured in the <span className="font-mono">.env</span> file. We have loaded this secure simulation window to verify signature verifications, upgrade your user profile, and write HTML invoicing emails to <span className="font-mono">/server/invoices/</span>.
            </p>

            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-500">Plan Upgrade:</span>
                <span className="font-bold text-brand-500">{checkoutModal.plan} Tier</span>
              </div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-500">Order ID:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-[10px]">{checkoutModal.orderId}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                <span className="text-slate-800 dark:text-slate-100">Amount Charged:</span>
                <span className="text-slate-900 dark:text-white">₹{checkoutModal.amount}.00</span>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-inner">
                <QRCodeCanvas
                  value={`ORDER:${checkoutModal.orderId}|PLAN:${checkoutModal.plan}|AMOUNT:₹${checkoutModal.amount}`}
                  size={160}
                  level="H"
                  includeMargin={true}
                  bgColor="#FFFFFF"
                  fgColor="#1E121E"
                />
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
                <QrCode className="w-4 h-4" />
                <span>Scan QR code to complete payment</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCheckoutModal({ show: false, orderId: '', plan: '', amount: 0 })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg"
              >
                Cancel Checkout
              </button>
              
              <button
                onClick={handleMockSuccess}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg shadow-green-500/10 hover:shadow-green-500/20 active:scale-95 transition-all"
              >
                Authorize & Pay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
