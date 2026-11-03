import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Zap,
  Check,
  ShieldCheck,
  Phone,
  ArrowLeft,
  AlertCircle,
  Tag,
  Lock,
  Copy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SaaSPlan } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { checkoutFormSchema, formatZodFieldErrors } from '../schemas/validation';

const FALLBACK_PLANS: SaaSPlan[] = [
  {
    id: 'plan-free',
    name: 'Free Starter',
    description: 'Starter tier with 30 free audio minutes to test the platform',
    priceBdt: 0,
    priceUsd: 0,
    interval: 'monthly',
    creditsGranted: 30,
    features: ['30 Minutes Audio Credits', 'SRT & TXT Subtitle Export', 'Standard Processing Speed', 'Bengali Voice AI Recognition'],
    modules: ['subtitles_editor', 'voice_recorder'],
    isPopular: false,
    isActive: true,
  },
  {
    id: 'plan-pro',
    name: 'Pro Creator',
    description: 'Best for active YouTubers, podcasters and media producers',
    priceBdt: 999,
    priceUsd: 10,
    interval: 'monthly',
    creditsGranted: 300,
    features: ['300 Minutes Audio Credits/Month', 'All Exports (SRT, DOCX, TXT, JSON)', 'AI YouTube Title & Chapter Generator', '16:9 HD Thumbnail Canvas Studio', 'Priority Multimodal Processing'],
    modules: ['subtitles_editor', 'voice_recorder', 'youtube_seo', 'thumbnail_canvas', 'advanced_export'],
    isPopular: true,
    isActive: true,
  },
  {
    id: 'plan-agency',
    name: 'Agency Studio',
    description: 'High-volume capacity for digital agencies and production houses',
    priceBdt: 2499,
    priceUsd: 25,
    interval: 'monthly',
    creditsGranted: 1200,
    features: ['1,200 Minutes Audio Credits/Month', 'Unlimited 4K Thumbnail Exports', 'Custom Watermarks & Branding', 'Full API Access & Fast Processing', 'Priority 24/7 Dedicated Support'],
    modules: ['subtitles_editor', 'voice_recorder', 'youtube_seo', 'thumbnail_canvas', 'advanced_export', 'batch_processing'],
    isPopular: false,
    isActive: true,
  },
];

const GATEWAY_CONFIG = {
  bkash: {
    name: 'bKash',
    color: '#D12053',
    accountNumber: '01876-543210',
    type: 'Merchant / Send Money',
    ussd: '*247#',
    instructions: 'Open bKash App or dial *247# → Send Money or Make Payment to 01876-543210 → Copy the 10-character TrxID from your SMS.',
    exampleTrx: 'BKA9X72K1L',
  },
  nagad: {
    name: 'Nagad',
    color: '#E04122',
    accountNumber: '01712-345678',
    type: 'Merchant / Send Money',
    ussd: '*167#',
    instructions: 'Open Nagad App or dial *167# → Send Money to 01712-345678 → Copy the 8-character TrxID from your SMS.',
    exampleTrx: '7NG824KD',
  },
  rocket: {
    name: 'Rocket (DBBL)',
    color: '#8C3295',
    accountNumber: '01912-3456789',
    type: 'Merchant / Bill Pay',
    ussd: '*322#',
    instructions: 'Open Rocket App or dial *322# → Send Money or Bill Pay to 01912-3456789 → Copy the Transaction ID.',
    exampleTrx: 'RCK8103942',
  },
};

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose }) => {
  const { user, token, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<SaaSPlan[]>(FALLBACK_PLANS);

  // Checkout Stage: 'plans' | 'checkout' | 'receipt'
  const [stage, setStage] = useState<'plans' | 'checkout' | 'receipt'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<SaaSPlan | null>(null);

  // Payment method: strictly bKash, Nagad, Rocket (Card removed)
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'rocket'>('bkash');
  const [walletPhone, setWalletPhone] = useState<string>('');
  const [trxId, setTrxId] = useState<string>('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [copiedNumber, setCopiedNumber] = useState(false);

  // Errors & Processing State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    planName: string;
    creditsGranted: number;
    amountPaid: string;
    method: string;
  } | null>(null);

  useEffect(() => {
    safeFetchJson<{ success: boolean; data: SaaSPlan[] }>('/api/plans').then((res) => {
      if (res.ok && res.data?.data && res.data.data.length > 0) {
        setPlans(res.data.data);
      }
    });
  }, []);

  if (!isOpen) return null;

  // Check if current user is on a paid plan
  const isPaidUser = Boolean(user?.planId && user.planId !== 'plan-free');

  const handleSelectPlanToCheckout = (plan: SaaSPlan) => {
    // Downgrade protection: if user is already on a paid plan, they cannot choose free plan
    if (isPaidUser && plan.id === 'plan-free') {
      setErrorMessage('Downgrades to the Free Starter plan are not permitted for active paid subscriptions.');
      return;
    }

    setSelectedPlan(plan);
    setFormErrors({});
    setErrorMessage(null);

    // Generate fresh idempotency key for this checkout attempt
    const newIdempKey = `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    setIdempotencyKey(newIdempKey);

    if (plan.priceBdt === 0) {
      executeSubscription(plan.id, 0, newIdempKey, 'FREE_ACTIVATION', '01700000000');
    } else {
      setStage('checkout');
    }
  };

  const handleWalletPhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    setWalletPhone(raw);
    if (formErrors.walletPhone) {
      setFormErrors((prev) => ({ ...prev, walletPhone: '' }));
    }
  };

  const handleTrxIdChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 14);
    setTrxId(clean);
    if (formErrors.trxId) {
      setFormErrors((prev) => ({ ...prev, trxId: '' }));
    }
  };

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === 'BANGLA20') {
      setAppliedDiscount(0.2); // 20% off
      setPromoMessage('20% creator discount applied!');
    } else if (code === 'CREATOR10') {
      setAppliedDiscount(0.1); // 10% off
      setPromoMessage('10% creator discount applied!');
    } else {
      setAppliedDiscount(0);
      setPromoMessage('Invalid promo code. Try "BANGLA20"');
    }
  };

  const copyAccountNumber = (num: string) => {
    navigator.clipboard.writeText(num.replace(/-/g, ''));
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const validateCheckout = (): boolean => {
    const parse = checkoutFormSchema.safeParse({
      paymentMethod,
      walletPhone,
      trxId,
    });

    if (!parse.success) {
      setFormErrors(formatZodFieldErrors(parse.error));
      return false;
    }

    setFormErrors({});
    return true;
  };

  const executeSubscription = async (
    planId: string,
    finalPrice: number,
    idempKey: string,
    txnIdParam: string,
    phoneParam: string
  ) => {
    if (!token) {
      setErrorMessage('Please sign in to complete subscription checkout.');
      return;
    }

    setIsSubscribing(true);
    setErrorMessage(null);

    try {
      const res = await safeFetchJson<{
        success: boolean;
        message: string;
        orderId?: string;
        error?: string;
      }>('/api/user/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId,
          paymentMethod,
          amountPaid: finalPrice,
          currency: 'BDT',
          trxId: txnIdParam,
          phoneNumber: phoneParam,
          idempotencyKey: idempKey,
        }),
      });

      if (res.ok && res.data?.success) {
        await refreshProfile();
        const currentSelected = plans.find((p) => p.id === planId) || selectedPlan;
        setCompletedOrder({
          orderId: res.data.orderId || txnIdParam || `BS-${Math.floor(100000 + Math.random() * 900000)}`,
          planName: currentSelected?.name || 'Pro Creator',
          creditsGranted: currentSelected?.creditsGranted || 300,
          amountPaid: `৳${finalPrice}`,
          method: GATEWAY_CONFIG[paymentMethod].name,
        });
        setStage('receipt');
      } else {
        setErrorMessage(
          res.error || res.data?.error || 'Payment authorization failed. Please verify your TrxID and phone number.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment network failure. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!validateCheckout()) return;

    const baseAmount = selectedPlan.priceBdt;
    const finalAmount = Math.max(0, Math.round(baseAmount * (1 - appliedDiscount)));
    executeSubscription(selectedPlan.id, finalAmount, idempotencyKey, trxId, walletPhone);
  };

  const activeGateway = GATEWAY_CONFIG[paymentMethod];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-title"
        className="bg-[#181818] border border-[#282828] rounded-2xl w-full max-w-4xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#282828] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1ed760]/10 text-[#1ed760] flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 id="pricing-title" className="text-base font-bold text-white tracking-tight">
                {stage === 'plans' && 'Subscription Plans & Quota Activation'}
                {stage === 'checkout' && `bKash, Nagad & Rocket Checkout — ${selectedPlan?.name}`}
                {stage === 'receipt' && 'Subscription Confirmed & Activated'}
              </h2>
              <p className="text-xs text-[#b3b3b3]">
                {stage === 'plans' && 'Top up audio minutes and unlock advanced creator capabilities'}
                {stage === 'checkout' && 'Idempotent, secure mobile payment processing for Bangladeshi creators'}
                {stage === 'receipt' && 'Your quota has been synchronized to your Cloud SQL profile'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================================= */}
          {/* STAGE 1: PLAN SELECTION                                                   */}
          {/* ========================================================================= */}
          {stage === 'plans' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((p) => {
                const isCurrent = user?.planId === p.id;
                const isPro = p.isPopular || p.id === 'plan-pro';
                const isFree = p.id === 'plan-free';
                // Downgrade protection: if user is currently on paid plan, free plan cannot be chosen
                const isDowngradeBlocked = isPaidUser && isFree;

                const formattedPrice = p.priceBdt === 0 ? 'Free' : `৳${p.priceBdt.toLocaleString()}`;

                return (
                  <Card
                    key={p.id}
                    className={`p-6 flex flex-col justify-between transition-all bg-[#181818] ${
                      isPro
                        ? 'border-[#1ed760] shadow-[0_4px_24px_rgba(30,215,96,0.15)]'
                        : isDowngradeBlocked
                        ? 'border-[#282828] opacity-65'
                        : 'border-[#282828] hover:border-[#383838]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        {isPro ? (
                          <Badge variant="default" className="text-[10px] font-bold">
                            Recommended
                          </Badge>
                        ) : isDowngradeBlocked ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                            <Lock className="w-3 h-3" />
                            <span>No Downgrade</span>
                          </span>
                        ) : (
                          <span />
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white mb-1">{p.name}</h3>
                      <p className="text-xs text-[#b3b3b3] mb-4 min-h-[32px]">{p.description}</p>

                      <div className="pb-4 border-b border-[#282828] mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold font-mono text-white">
                            {formattedPrice}
                          </span>
                          {p.priceBdt > 0 && (
                            <span className="text-xs text-[#b3b3b3]">/ month</span>
                          )}
                        </div>
                        <div className="text-xs text-[#1ed760] font-semibold mt-1">
                          {p.creditsGranted} Audio Minutes Included
                        </div>
                      </div>

                      <ul className="space-y-2 text-xs text-[#b3b3b3] mb-6">
                        {p.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-[#1ed760] shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      disabled={isCurrent || isDowngradeBlocked}
                      onClick={() => handleSelectPlanToCheckout(p)}
                      variant={isCurrent ? 'secondary' : isPro ? 'default' : 'outline'}
                      size="default"
                      className="w-full"
                    >
                      {isCurrent
                        ? 'Current Plan'
                        : isDowngradeBlocked
                        ? 'Cannot Downgrade to Free'
                        : isFree
                        ? 'Select Free'
                        : 'Pay with bKash / Nagad / Rocket'}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 2: HARDENED MOBILE WALLET CHECKOUT (BKASH, NAGAD, ROCKET)           */}
          {/* ========================================================================= */}
          {stage === 'checkout' && selectedPlan && (
            <div className="max-w-2xl mx-auto space-y-6">
              <button
                type="button"
                onClick={() => setStage('plans')}
                className="text-xs text-[#b3b3b3] hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Plans</span>
              </button>

              {/* Payment Gateway Tabs */}
              <div className="p-4 rounded-xl bg-[#1f1f1f] border border-[#282828] space-y-3">
                <div className="text-xs font-semibold text-white">Select Mobile Payment Gateway:</div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('bkash');
                      setFormErrors({});
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'bkash'
                        ? 'bg-[#181818] border-[#D12053] text-white shadow-[0_0_12px_rgba(209,32,83,0.2)]'
                        : 'bg-[#141414] border-[#282828] text-[#b3b3b3] hover:border-[#383838]'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#D12053] text-white flex items-center justify-center font-bold text-xs">
                      b
                    </div>
                    <span className="text-xs font-bold">bKash</span>
                    <span className="text-[10px] text-[#7c7c7c]">Merchant Dial *247#</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('nagad');
                      setFormErrors({});
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'nagad'
                        ? 'bg-[#181818] border-[#E04122] text-white shadow-[0_0_12px_rgba(224,65,34,0.2)]'
                        : 'bg-[#141414] border-[#282828] text-[#b3b3b3] hover:border-[#383838]'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#E04122] text-white flex items-center justify-center font-bold text-xs">
                      ন
                    </div>
                    <span className="text-xs font-bold">Nagad</span>
                    <span className="text-[10px] text-[#7c7c7c]">Dial *167#</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('rocket');
                      setFormErrors({});
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'rocket'
                        ? 'bg-[#181818] border-[#8C3295] text-white shadow-[0_0_12px_rgba(140,50,149,0.2)]'
                        : 'bg-[#141414] border-[#282828] text-[#b3b3b3] hover:border-[#383838]'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#8C3295] text-white flex items-center justify-center font-bold text-xs">
                      R
                    </div>
                    <span className="text-xs font-bold">Rocket</span>
                    <span className="text-[10px] text-[#7c7c7c]">DBBL Dial *322#</span>
                  </button>
                </div>
              </div>

              {/* Step-by-Step Payment Instructions */}
              <div className="p-4 rounded-xl bg-[#141414] border border-[#282828] space-y-2.5">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>How to Pay with {activeGateway.name}:</span>
                  <span className="font-mono text-[#1ed760] text-[11px] font-bold">
                    Total: ৳{Math.round(selectedPlan.priceBdt * (1 - appliedDiscount))} BDT
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#1f1f1f] border border-[#282828]">
                  <div>
                    <div className="text-[11px] text-[#b3b3b3]">BanglaScribe Official {activeGateway.name} Account:</div>
                    <div className="text-sm font-mono font-bold text-white tracking-wide mt-0.5">
                      {activeGateway.accountNumber} ({activeGateway.type})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyAccountNumber(activeGateway.accountNumber)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#282828] hover:bg-[#383838] text-white text-xs font-bold rounded-full transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedNumber ? 'Copied!' : 'Copy Number'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-[#b3b3b3] leading-relaxed">
                  {activeGateway.instructions}
                </p>
              </div>

              {/* Verification Form with Sender Mobile & TrxID */}
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div className="p-5 rounded-xl bg-[#1f1f1f] border border-[#282828] space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-white block mb-1">
                      Sender {activeGateway.name} Mobile Number
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-2 bg-[#141414] border border-[#282828] rounded-full text-xs text-[#b3b3b3] font-mono">
                        +88
                      </span>
                      <Input
                        value={walletPhone}
                        onChange={(e) => handleWalletPhoneChange(e.target.value)}
                        placeholder="01712345678"
                        className="text-xs font-mono flex-1"
                      />
                    </div>
                    {formErrors.walletPhone && (
                      <p className="text-[11px] text-rose-400 mt-1">{formErrors.walletPhone}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-white block mb-1">
                      {activeGateway.name} Transaction ID (TrxID)
                    </label>
                    <Input
                      value={trxId}
                      onChange={(e) => handleTrxIdChange(e.target.value)}
                      placeholder={`e.g. ${activeGateway.exampleTrx}`}
                      className="text-xs font-mono uppercase"
                    />
                    {formErrors.trxId && (
                      <p className="text-[11px] text-rose-400 mt-1">{formErrors.trxId}</p>
                    )}
                    <span className="text-[10px] text-[#7c7c7c] mt-1 block">
                      Found in the confirmation SMS received from {activeGateway.name}.
                    </span>
                  </div>
                </div>

                {/* Promo Code Drawer */}
                <div className="p-4 rounded-xl bg-[#141414] border border-[#282828] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Tag className="w-4 h-4 text-[#1ed760] shrink-0" />
                    <Input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Promo Code (BANGLA20)"
                      className="text-xs uppercase font-mono max-w-[200px]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-3 py-1.5 bg-[#282828] hover:bg-[#383838] text-white text-xs font-bold rounded-full transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  {promoMessage && (
                    <span className="text-[11px] font-semibold text-[#1ed760]">
                      {promoMessage}
                    </span>
                  )}
                </div>

                {/* Order Summary & Idempotency Guarantee */}
                <div className="p-4 rounded-xl bg-[#181818] border border-[#282828] space-y-2 text-xs">
                  <div className="flex justify-between text-[#b3b3b3]">
                    <span>Selected Plan:</span>
                    <span className="font-semibold text-white">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between text-[#b3b3b3]">
                    <span>Audio Quota Credit:</span>
                    <span className="font-mono text-[#1ed760]">
                      +{selectedPlan.creditsGranted} Minutes
                    </span>
                  </div>
                  <div className="flex justify-between text-[#b3b3b3]">
                    <span>Plan Price:</span>
                    <span className="font-mono">৳{selectedPlan.priceBdt} BDT</span>
                  </div>
                  {appliedDiscount > 0 && (
                    <div className="flex justify-between text-[#1ed760]">
                      <span>Discount ({(appliedDiscount * 100).toFixed(0)}%):</span>
                      <span className="font-mono">
                        -৳{Math.round(selectedPlan.priceBdt * appliedDiscount)} BDT
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[#282828] flex justify-between text-sm font-bold text-white">
                    <span>Total Payable:</span>
                    <span className="font-mono text-[#1ed760]">
                      ৳{Math.round(selectedPlan.priceBdt * (1 - appliedDiscount))} BDT
                    </span>
                  </div>
                  <div className="pt-1 text-[10px] font-mono text-[#7c7c7c]">
                    Idempotency Session: {idempotencyKey.slice(0, 22)}...
                  </div>
                </div>

                {/* Submit with Double-Submission Guard */}
                <Button
                  type="submit"
                  disabled={isSubscribing}
                  size="lg"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {isSubscribing
                      ? 'Verifying Transaction with Cloud SQL...'
                      : `Confirm & Activate Subscription (৳${Math.round(selectedPlan.priceBdt * (1 - appliedDiscount))})`}
                  </span>
                </Button>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 3: ORDER CONFIRMED RECEIPT                                          */}
          {/* ========================================================================= */}
          {stage === 'receipt' && completedOrder && (
            <div className="max-w-md mx-auto text-center space-y-6 py-6">
              <div className="w-16 h-16 rounded-full bg-[#1ed760]/10 text-[#1ed760] mx-auto flex items-center justify-center shadow-[0_0_24px_rgba(30,215,96,0.3)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Subscription Verified & Activated!
                </h3>
                <p className="text-xs text-[#b3b3b3] mt-1">
                  Your audio minutes quota has been deposited to your Cloud SQL profile.
                </p>
              </div>

              {/* Receipt Card */}
              <div className="p-5 rounded-2xl bg-[#1f1f1f] border border-[#282828] text-left space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
                  <span className="text-[#b3b3b3]">Transaction ID:</span>
                  <span className="font-mono font-bold text-white">{completedOrder.orderId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#b3b3b3]">Plan Activated:</span>
                  <span className="font-bold text-white">{completedOrder.planName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#b3b3b3]">Audio Minutes Credited:</span>
                  <span className="font-mono font-bold text-[#1ed760]">
                    +{completedOrder.creditsGranted} Minutes
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#b3b3b3]">Amount Paid:</span>
                  <span className="font-mono font-bold text-white">{completedOrder.amountPaid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#b3b3b3]">Gateway:</span>
                  <span className="font-mono text-[#b3b3b3]">{completedOrder.method}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={onClose}
                  size="default"
                  className="px-6"
                >
                  Return to Studio Workspace
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#121212] border-t border-[#282828] flex items-center justify-between text-xs text-[#b3b3b3]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#1ed760]" />
            <span>Bangladeshi mobile wallet verification with idempotency protection</span>
          </div>
          <div>BanglaScribe SaaS</div>
        </div>
      </div>
    </div>
  );
};
