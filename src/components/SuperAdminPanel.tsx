import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Package,
  Users,
  CreditCard,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Search,
  RefreshCw,
  TrendingUp,
  Receipt,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SaaSUser,
  SaaSPlan,
  SaaSSubscription,
  SaaSPayment,
  PlanModule,
} from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { adminPlanCreateSchema, formatZodFieldErrors } from '../schemas/validation';
import { Input } from './ui/input';

const AVAILABLE_MODULES: { id: PlanModule; label: string; desc: string }[] = [
  { id: 'subtitles_editor', label: 'Subtitles & Waveform Editor', desc: 'Timestamped Bengali subtitle editor' },
  { id: 'voice_recorder', label: 'Audio & Voice Recorder', desc: 'Upload audio files & direct browser recorder' },
  { id: 'youtube_seo', label: 'YouTube SEO & AI Metadata', desc: 'AI titles, descriptions, hashtags & chapters' },
  { id: 'thumbnail_canvas', label: '16:9 Thumbnail Studio', desc: 'Custom Bengali canvas & PNG export' },
  { id: 'advanced_export', label: 'Advanced Export (DOCX, JSON)', desc: 'Professional export formats for studios' },
  { id: 'batch_processing', label: 'Batch Transcription', desc: 'Multi-file queued audio processing' },
];

export const SuperAdminPanel: React.FC = () => {
  const { token } = useAuth();
  const [activeAdminTab, setActiveAdminTab] = useState<'plans' | 'users' | 'subscriptions' | 'payments'>('plans');

  // Data States
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [usersList, setUsersList] = useState<SaaSUser[]>([]);
  const [subscriptionsList, setSubscriptionsList] = useState<SaaSSubscription[]>([]);
  const [paymentsList, setPaymentsList] = useState<SaaSPayment[]>([]);
  const [analytics, setAnalytics] = useState<{
    totalRevenue: number;
    mrr: number;
    activeSubscribersCount: number;
    totalTransactions: number;
  }>({ totalRevenue: 0, mrr: 0, activeSubscribersCount: 0, totalTransactions: 0 });

  const [isLoading, setIsLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // User Filter & Search
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  // Plan Modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);
  const [planForm, setPlanForm] = useState<{
    name: string;
    description: string;
    priceBdt: number;
    priceUsd: number;
    interval: 'monthly' | 'yearly';
    creditsGranted: number;
    featuresText: string;
    modules: PlanModule[];
  }>({
    name: '',
    description: '',
    priceBdt: 999,
    priceUsd: 10,
    interval: 'monthly',
    creditsGranted: 300,
    featuresText: 'SRT & TXT Subtitle Export\nAI YouTube Title & Chapters\n16:9 HD Thumbnail Studio',
    modules: ['subtitles_editor', 'voice_recorder'],
  });
  const [planFormErrors, setPlanFormErrors] = useState<Record<string, string>>({});

  // Credit Adjustment Modal
  const [selectedUserForCredit, setSelectedUserForCredit] = useState<SaaSUser | null>(null);
  const [bonusCreditsInput, setBonusCreditsInput] = useState<number>(60);

  // Fetch all admin data from PostgreSQL
  const fetchAdminData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [resPlans, resUsers, resSubs, resPayments] = await Promise.all([
        safeFetchJson<{ success: boolean; data: SaaSPlan[] }>('/api/admin/plans', { headers }),
        safeFetchJson<{ success: boolean; data: SaaSUser[] }>('/api/admin/users', { headers }),
        safeFetchJson<{ success: boolean; data: SaaSSubscription[] }>('/api/admin/subscriptions', { headers }),
        safeFetchJson<{ success: boolean; data: SaaSPayment[]; analytics?: any }>('/api/admin/payments', { headers }),
      ]);

      if (resPlans.ok && resPlans.data?.success && resPlans.data.data) {
        setPlans(resPlans.data.data);
      }
      if (resUsers.ok && resUsers.data?.success && resUsers.data.data) {
        setUsersList(resUsers.data.data);
      }
      if (resSubs.ok && resSubs.data?.success && resSubs.data.data) {
        setSubscriptionsList(resSubs.data.data);
      }
      if (resPayments.ok && resPayments.data?.success && resPayments.data.data) {
        setPaymentsList(resPayments.data.data);
        if (resPayments.data.analytics) setAnalytics(resPayments.data.analytics);
      }
    } catch (err) {
      console.warn('Admin data load warning:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token]);

  const showNotification = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Plan Handlers (Validated with Zod adminPlanCreateSchema)
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanFormErrors({});

    const featuresList = planForm.featuresText.split('\n').map((f) => f.trim()).filter(Boolean);

    const parse = adminPlanCreateSchema.safeParse({
      name: planForm.name,
      description: planForm.description,
      priceBdt: Number(planForm.priceBdt || planForm.priceUsd * 110),
      priceUsd: Number(planForm.priceUsd),
      interval: planForm.interval,
      creditsGranted: Number(planForm.creditsGranted),
      features: featuresList,
      modules: planForm.modules,
    });

    if (!parse.success) {
      setPlanFormErrors(formatZodFieldErrors(parse.error));
      return;
    }

    const payload = {
      name: planForm.name.trim(),
      description: planForm.description.trim(),
      priceBdt: Number(planForm.priceBdt || planForm.priceUsd * 110),
      priceUsd: Number(planForm.priceUsd),
      interval: planForm.interval,
      creditsGranted: Number(planForm.creditsGranted),
      features: planForm.featuresText.split('\n').filter((f) => f.trim().length > 0),
      modules: planForm.modules,
    };

    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      if (editingPlan) {
        const res = await safeFetchJson(`/api/admin/plans/${editingPlan.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
        if (res.ok) showNotification('Plan updated successfully in PostgreSQL!');
      } else {
        const res = await safeFetchJson('/api/admin/plans', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (res.ok) showNotification('New subscription plan created in PostgreSQL!');
      }
      setShowPlanModal(false);
      setEditingPlan(null);
      fetchAdminData();
    } catch (err) {
      console.warn('Plan save warning:', err);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await safeFetchJson(`/api/admin/plans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      showNotification('Plan removed from database.');
      fetchAdminData();
    } catch (err) {
      console.warn('Plan delete warning:', err);
    }
  };

  // User Status & Credit Adjustment Handlers
  const handleToggleUserStatus = async (user: SaaSUser) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await safeFetchJson(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      showNotification(`Account for ${user.name} is now ${newStatus === 'active' ? 'Active' : 'Suspended'}.`);
      fetchAdminData();
    } catch (err) {
      console.warn('Status toggle warning:', err);
    }
  };

  const handleAddBonusCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForCredit) return;

    try {
      const newCredits = selectedUserForCredit.creditsRemaining + bonusCreditsInput;
      const newTotal = selectedUserForCredit.creditsTotal + bonusCreditsInput;

      await safeFetchJson(`/api/admin/users/${selectedUserForCredit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          creditsRemaining: newCredits,
          creditsTotal: newTotal,
        }),
      });

      showNotification(`Added ${bonusCreditsInput} audio minutes to ${selectedUserForCredit.name}!`);
      setSelectedUserForCredit(null);
      fetchAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  // Only creator users (non-superadmins) are counted and displayed
  const creatorUsers = usersList.filter((u) => u.role !== 'superadmin');

  const filteredUsers = creatorUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesStatus = userStatusFilter === 'all' || u.status === userStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header & KPI Bar */}
      <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-display">
                  SuperAdmin Control Center
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage subscription plans, user audio minute credits, subscriptions, and payment invoices.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAdminData}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </Button>
          </div>
        </div>

        {/* Action Notification */}
        {actionSuccess && (
          <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* 4 Revenue & SaaS KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <Card className="p-4 bg-slate-900/60">
            <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
              <span>Total Revenue</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
              ${analytics.totalRevenue.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Processed from paid subscriptions</div>
          </Card>

          <Card className="p-4 bg-slate-900/60">
            <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
              <span>Monthly Recurring Revenue (MRR)</span>
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-bold font-mono text-blue-400 tabular-nums">
              ${analytics.mrr.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Active subscriber monthly cadence</div>
          </Card>

          <Card className="p-4 bg-slate-900/60">
            <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
              <span>Active Paid Subscribers</span>
              <CreditCard className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-purple-400 tabular-nums">
              {analytics.activeSubscribersCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Pro & Agency accounts</div>
          </Card>

          <Card className="p-4 bg-slate-900/60">
            <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
              <span>Total Registered Users</span>
              <Users className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
              {creatorUsers.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Creator accounts (excluding admin)</div>
          </Card>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#0f1726] rounded-lg border border-slate-800 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveAdminTab('plans')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'plans'
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Plans Management</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('users')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'users'
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users & Audio Credits</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('subscriptions')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'subscriptions'
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Subscriptions</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('payments')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'payments'
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Payments & Ledger</span>
        </button>
      </div>

      {/* ================= TAB 1: PLANS MANAGEMENT ================= */}
      {activeAdminTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-display">
              Subscription Tiers in PostgreSQL ({plans.length} Total)
            </h3>
            <Button
              onClick={() => {
                setEditingPlan(null);
                setPlanForm({
                  name: '',
                  description: '',
                  priceBdt: 999,
                  priceUsd: 10,
                  interval: 'monthly',
                  creditsGranted: 300,
                  featuresText: 'SRT & TXT Subtitle Export\nAI YouTube Titles & Chapters\n16:9 HD Thumbnail Studio',
                  modules: ['subtitles_editor', 'voice_recorder'],
                });
                setShowPlanModal(true);
              }}
              size="sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Plan</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className="p-5 flex flex-col justify-between relative group hover:border-slate-700"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-purple-400 font-semibold">
                      {plan.id}
                    </span>
                    <Badge variant={plan.isActive ? 'emerald' : 'destructive'} className="text-[10px]">
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <h4 className="text-lg font-bold text-white font-display mb-1">
                    {plan.name}
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">{plan.description}</p>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono text-white">
                        ${plan.priceUsd}
                      </span>
                      <span className="text-xs text-slate-400">/mo (৳{plan.priceBdt})</span>
                    </div>
                    <div className="text-xs text-emerald-400 font-semibold mt-1">
                      {plan.creditsGranted} Audio Minutes Granted
                    </div>
                  </div>

                  {/* Module Access Tags */}
                  <div className="mb-4">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
                      Module Access:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {plan.modules && plan.modules.length > 0 ? (
                        plan.modules.map((m) => (
                          <Badge
                            key={m}
                            variant="purple"
                            className="text-[10px] capitalize"
                          >
                            {m.replace(/_/g, ' ')}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">No modules enabled</span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-1.5 text-xs text-slate-300 mb-5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setEditingPlan(plan);
                      setPlanForm({
                        name: plan.name,
                        description: plan.description,
                        priceBdt: plan.priceBdt,
                        priceUsd: plan.priceUsd,
                        interval: plan.interval,
                        creditsGranted: plan.creditsGranted,
                        featuresText: plan.features.join('\n'),
                        modules: plan.modules && plan.modules.length > 0 ? plan.modules : ['subtitles_editor', 'voice_recorder'],
                      });
                      setShowPlanModal(true);
                    }}
                    className="flex items-center gap-1 text-xs text-slate-300 hover:text-white"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Edit Plan</span>
                  </button>

                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 2: USERS & AUDIO CREDITS ================= */}
      {activeAdminTab === 'users' && (
        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white font-display">
              Creator Accounts & Audio Credits ({creatorUsers.length} Users)
            </h3>
            <span className="text-xs text-slate-400">Manage audio minute allowances and account status</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search creator by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Status Filter:</span>
              <select
                value={userStatusFilter}
                onChange={(e: any) => setUserStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                <tr>
                  <th className="p-3">Creator Account</th>
                  <th className="p-3">Active Plan</th>
                  <th className="p-3">Audio Minutes Remaining</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      No creator accounts found matching search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    return (
                      <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-slate-100">{u.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                        </td>
                        <td className="p-3 font-medium text-slate-200">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-200 border border-slate-700">
                            {u.planName}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span className={`font-semibold ${u.creditsRemaining <= 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                              {u.creditsRemaining}
                            </span>
                            <span className="text-slate-500">
                              / {u.creditsTotal} mins
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`text-xs font-medium ${u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {u.status === 'active' ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => setSelectedUserForCredit(u)}
                            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            + Add Credits
                          </button>

                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                              u.status === 'active'
                                ? 'bg-red-950/60 text-red-300 hover:bg-red-900/60'
                                : 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
                            }`}
                          >
                            {u.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: SUBSCRIPTIONS ================= */}
      {activeAdminTab === 'subscriptions' && (
        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white font-display">
            Active Subscriptions ({subscriptionsList.length} Total)
          </h3>

          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                <tr>
                  <th className="p-3">Subscriber</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Cadence</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Next Renewal</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {subscriptionsList.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-slate-100">{sub.userName || 'Subscriber'}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{sub.userEmail}</div>
                    </td>
                    <td className="p-3 font-semibold text-purple-300">{sub.planName}</td>
                    <td className="p-3 uppercase font-mono text-slate-400">{sub.billingCycle}</td>
                    <td className="p-3 font-mono font-bold text-white">
                      ${sub.amount} {sub.currency}
                    </td>
                    <td className="p-3 font-mono text-slate-400">
                      {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: PAYMENTS & INVOICES ================= */}
      {activeAdminTab === 'payments' && (
        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white font-display">
            Transaction Ledger & Invoices ({paymentsList.length} Total)
          </h3>

          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                <tr>
                  <th className="p-3">Txn Reference</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Gateway</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {paymentsList.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 font-mono text-slate-300 font-semibold">{pay.transactionId}</td>
                    <td className="p-3 text-slate-200">{pay.userEmail}</td>
                    <td className="p-3 font-medium text-slate-300">{pay.planName}</td>
                    <td className="p-3 uppercase font-mono font-bold text-amber-400">{pay.method}</td>
                    <td className="p-3 font-mono font-bold text-white">${pay.amount}</td>
                    <td className="p-3 font-mono text-slate-400">
                      {new Date(pay.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          pay.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {pay.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bonus Credit Adjustment Modal */}
      {selectedUserForCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101726] border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
            <h4 className="text-sm font-bold text-white font-display mb-1 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Grant Bonus Audio Credits</span>
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Add audio minutes to {selectedUserForCredit.name}&apos;s balance in PostgreSQL.
            </p>

            <form onSubmit={handleAddBonusCredits} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Minutes to Add:</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={bonusCreditsInput}
                  onChange={(e) => setBonusCreditsInput(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForCredit(null)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold rounded-lg shadow-sm"
                >
                  Confirm Grant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Create / Edit Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101726] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-display">
                {editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
              </h3>
              <button
                onClick={() => setShowPlanModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Plan Name:</label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="e.g. Creator Plus"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                />
                {planFormErrors.name && (
                  <p className="text-[10px] text-red-400 mt-1">{planFormErrors.name}</p>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Description:</label>
                <input
                  type="text"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="e.g. Best for growing YouTube creators..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Price (USD $):</label>
                  <input
                    type="number"
                    value={planForm.priceUsd}
                    onChange={(e) => setPlanForm({ ...planForm, priceUsd: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Audio Credits (Minutes):</label>
                  <input
                    type="number"
                    value={planForm.creditsGranted}
                    onChange={(e) => setPlanForm({ ...planForm, creditsGranted: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Features List (One item per line):</label>
                <textarea
                  rows={3}
                  value={planForm.featuresText}
                  onChange={(e) => setPlanForm({ ...planForm, featuresText: e.target.value })}
                  placeholder="SRT Subtitles&#10;AI YouTube Titles&#10;16:9 HD Thumbnails"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500 leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1.5 font-semibold">
                  Module-Wise Access Permissions:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
                  {AVAILABLE_MODULES.map((mod) => {
                    const isChecked = planForm.modules.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-purple-950/40 border-purple-500/50 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPlanForm({
                                ...planForm,
                                modules: [...planForm.modules, mod.id],
                              });
                            } else {
                              setPlanForm({
                                ...planForm,
                                modules: planForm.modules.filter((m) => m !== mod.id),
                              });
                            }
                          }}
                          className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-slate-200">{mod.label}</div>
                          <div className="text-[10px] text-slate-400 leading-tight">{mod.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold rounded-lg shadow-md transition-all"
                >
                  {editingPlan ? 'Update Plan' : 'Save Plan to PostgreSQL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
