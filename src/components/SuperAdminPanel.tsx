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
  FileText,
  BookOpen,
  Scale,
  Inbox,
  Mail,
  Clock,
  Save,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SaaSUser,
  SaaSPlan,
  SaaSSubscription,
  SaaSPayment,
  PlanModule,
  PlatformPolicy,
  PolicySlug,
  UserInquiry,
  InquiryStatus,
} from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { adminPlanCreateSchema, policyUpdateSchema, formatZodFieldErrors } from '../schemas/validation';
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
  const [activeAdminTab, setActiveAdminTab] = useState<'plans' | 'users' | 'subscriptions' | 'payments' | 'inquiries' | 'policies'>('plans');

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

  // User Inquiries State
  const [inquiriesList, setInquiriesList] = useState<UserInquiry[]>([]);
  const [inquiryCounts, setInquiryCounts] = useState<{
    total: number;
    unread: number;
    inReview: number;
    resolved: number;
  }>({ total: 0, unread: 0, inReview: 0, resolved: 0 });
  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(null);
  const [inquiryNotesDraft, setInquiryNotesDraft] = useState('');
  const [isUpdatingInquiry, setIsUpdatingInquiry] = useState(false);
  const [confirmDeleteInquiryId, setConfirmDeleteInquiryId] = useState<number | null>(null);

  // Legal Policies State
  const [policiesList, setPoliciesList] = useState<PlatformPolicy[]>([]);
  const [selectedPolicySlug, setSelectedPolicySlug] = useState<PolicySlug>('terms');
  const [policyTitleInput, setPolicyTitleInput] = useState<string>('');
  const [policyContentInput, setPolicyContentInput] = useState<string>('');
  const [isSavingPolicy, setIsSavingPolicy] = useState<boolean>(false);
  const [policyFormErrors, setPolicyFormErrors] = useState<Record<string, string>>({});
  const [policyPreviewMode, setPolicyPreviewMode] = useState<boolean>(false);

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

      const [resPlans, resUsers, resSubs, resPayments, resPolicies, resInquiries] = await Promise.all([
        safeFetchJson<{ success: boolean; data: SaaSPlan[] }>('/api/admin/plans', { headers }),
        safeFetchJson<{ success: boolean; data: SaaSUser[] }>('/api/admin/users', { headers }),
        safeFetchJson<{ success: boolean; data: SaaSSubscription[] }>('/api/admin/subscriptions', { headers }),
        safeFetchJson<{ success: boolean; data: SaaSPayment[]; analytics?: any }>('/api/admin/payments', { headers }),
        safeFetchJson<{ success: boolean; data: PlatformPolicy[] }>('/api/policies'),
        safeFetchJson<{
          success: boolean;
          data: UserInquiry[];
          counts?: { total: number; unread: number; inReview: number; resolved: number };
        }>('/api/admin/inquiries', { headers }),
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
      if (resPolicies.ok && resPolicies.data?.success && resPolicies.data.data) {
        setPoliciesList(resPolicies.data.data);
        const current = resPolicies.data.data.find((p) => p.slug === selectedPolicySlug);
        if (current) {
          setPolicyTitleInput(current.title);
          setPolicyContentInput(current.content);
        }
      }
      if (resInquiries.ok && resInquiries.data?.success && resInquiries.data.data) {
        const rows = resInquiries.data.data;
        setInquiriesList(rows);
        setInquiryCounts(
          resInquiries.data.counts || {
            total: rows.length,
            unread: rows.filter((r) => r.status === 'unread').length,
            inReview: rows.filter((r) => r.status === 'in_review').length,
            resolved: rows.filter((r) => r.status === 'resolved').length,
          }
        );
        const activeTarget =
          rows.find((r) => r.id === selectedInquiryId) || rows[0] || null;
        setSelectedInquiryId(activeTarget ? activeTarget.id : null);
        setInquiryNotesDraft(activeTarget ? activeTarget.adminNotes || '' : '');
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
        if (res.ok) showNotification('Plan updated successfully.');
      } else {
        const res = await safeFetchJson('/api/admin/plans', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (res.ok) showNotification('New subscription plan created.');
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

  // Policy Handlers (Validated with Zod policyUpdateSchema)
  const handleSelectPolicy = (slug: PolicySlug) => {
    setSelectedPolicySlug(slug);
    setPolicyFormErrors({});
    const found = policiesList.find((p) => p.slug === slug);
    if (found) {
      setPolicyTitleInput(found.title);
      setPolicyContentInput(found.content);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setPolicyFormErrors({});

    const parse = policyUpdateSchema.safeParse({
      title: policyTitleInput,
      content: policyContentInput,
    });

    if (!parse.success) {
      setPolicyFormErrors(formatZodFieldErrors(parse.error));
      return;
    }

    setIsSavingPolicy(true);
    try {
      const res = await safeFetchJson<{ success: boolean; data: PlatformPolicy; message?: string }>(
        `/api/admin/policies/${selectedPolicySlug}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: parse.data.title,
            content: parse.data.content,
          }),
        }
      );

      if (res.ok && res.data?.success) {
        showNotification(res.data.message || 'Policy updated successfully.');
        fetchAdminData();
      } else {
        setPolicyFormErrors({ _global: res.data?.message || 'Failed to save policy.' });
      }
    } catch (err: any) {
      setPolicyFormErrors({ _global: err.message || 'Network error saving policy.' });
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // User Inquiry Handlers
  const recomputeInquiryCounts = (rows: UserInquiry[]) => ({
    total: rows.length,
    unread: rows.filter((r) => r.status === 'unread').length,
    inReview: rows.filter((r) => r.status === 'in_review').length,
    resolved: rows.filter((r) => r.status === 'resolved').length,
  });

  const handleSelectInquiry = (inq: UserInquiry) => {
    setSelectedInquiryId(inq.id);
    setInquiryNotesDraft(inq.adminNotes || '');
    setConfirmDeleteInquiryId(null);
  };

  const handleUpdateInquiry = async (
    id: number,
    patch: { status?: InquiryStatus; adminNotes?: string },
    successText?: string
  ) => {
    if (!token) return;
    setIsUpdatingInquiry(true);
    try {
      const res = await safeFetchJson<{ success: boolean; data: UserInquiry; message?: string }>(
        `/api/admin/inquiries/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patch),
        }
      );

      if (res.ok && res.data?.success && res.data.data) {
        const updatedRow = res.data.data;
        const nextList = inquiriesList.map((item) => (item.id === id ? updatedRow : item));
        setInquiriesList(nextList);
        setInquiryCounts(recomputeInquiryCounts(nextList));
        if (patch.adminNotes !== undefined) {
          setInquiryNotesDraft(updatedRow.adminNotes || '');
        }
        showNotification(successText || 'Inquiry updated.');
      }
    } catch (err) {
      console.warn('Inquiry update warning:', err);
    } finally {
      setIsUpdatingInquiry(false);
    }
  };

  const handleDeleteInquiry = async (id: number) => {
    if (!token) return;
    setIsUpdatingInquiry(true);
    try {
      const res = await safeFetchJson<{ success: boolean; message?: string }>(
        `/api/admin/inquiries/${id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok && res.data?.success) {
        const nextList = inquiriesList.filter((item) => item.id !== id);
        setInquiriesList(nextList);
        setInquiryCounts(recomputeInquiryCounts(nextList));
        setConfirmDeleteInquiryId(null);
        const nextSelected = nextList[0] || null;
        setSelectedInquiryId(nextSelected ? nextSelected.id : null);
        setInquiryNotesDraft(nextSelected ? nextSelected.adminNotes || '' : '');
        showNotification('Inquiry removed from inbox.');
      }
    } catch (err) {
      console.warn('Inquiry delete warning:', err);
    } finally {
      setIsUpdatingInquiry(false);
    }
  };

  const filteredInquiries = inquiriesList.filter((inq) => {
    const q = inquirySearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inq.name.toLowerCase().includes(q) ||
      inq.email.toLowerCase().includes(q) ||
      (inq.subject || '').toLowerCase().includes(q) ||
      inq.message.toLowerCase().includes(q);
    const matchesStatus = inquiryStatusFilter === 'all' || inq.status === inquiryStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedInquiry =
    filteredInquiries.find((i) => i.id === selectedInquiryId) ||
    inquiriesList.find((i) => i.id === selectedInquiryId) ||
    filteredInquiries[0] ||
    null;

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
      <div className="bg-[#181818] border border-[#282828] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#282828]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#e4e7ec] font-display">
                  SuperAdmin Control Center
                </h2>
              </div>
              <p className="text-xs text-[#9ca3af] mt-0.5">
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
          <div className="mt-4 p-3 bg-[#132517] border border-[#1db954]/35 rounded-xl text-xs text-[#d0d5dd] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#3fb970] shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* 4 Revenue & SaaS KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <Card className="p-4 bg-[#181818] border-[#282828]">
            <div className="text-xs text-[#9ca3af] mb-1 flex items-center justify-between">
              <span>Total Revenue</span>
              <DollarSign className="w-4 h-4 text-[#3fb970]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#3fb970] tabular-nums">
              ${analytics.totalRevenue.toLocaleString()}
            </div>
            <div className="text-xs text-[#6f7682] mt-1">Processed from paid subscriptions</div>
          </Card>

          <Card className="p-4 bg-[#181818] border-[#282828]">
            <div className="text-xs text-[#9ca3af] mb-1 flex items-center justify-between">
              <span>Monthly Recurring Revenue (MRR)</span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-blue-400 tabular-nums">
              ${analytics.mrr.toLocaleString()}
            </div>
            <div className="text-xs text-[#6f7682] mt-1">Active subscriber monthly cadence</div>
          </Card>

          <Card className="p-4 bg-[#181818] border-[#282828]">
            <div className="text-xs text-[#9ca3af] mb-1 flex items-center justify-between">
              <span>Active Paid Subscribers</span>
              <CreditCard className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-purple-400 tabular-nums">
              {analytics.activeSubscribersCount}
            </div>
            <div className="text-xs text-[#6f7682] mt-1">Pro & Agency accounts</div>
          </Card>

          <Card className="p-4 bg-[#181818] border-[#282828]">
            <div className="text-xs text-[#9ca3af] mb-1 flex items-center justify-between">
              <span>Total Registered Users</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#e4e7ec] tabular-nums">
              {creatorUsers.length}
            </div>
            <div className="text-xs text-[#6f7682] mt-1">Creator accounts (excluding admin)</div>
          </Card>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#181818] rounded-full border border-[#282828] overflow-x-auto text-xs">
        <button
          onClick={() => setActiveAdminTab('plans')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'plans'
              ? 'bg-[#282828] text-[#e4e7ec] font-semibold'
              : 'text-[#9ca3af] hover:text-[#d0d5dd]'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Plans Management</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('users')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'users'
              ? 'bg-[#282828] text-[#e4e7ec] font-semibold'
              : 'text-[#9ca3af] hover:text-[#d0d5dd]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users & Audio Credits</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('subscriptions')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'subscriptions'
              ? 'bg-[#282828] text-[#e4e7ec] font-semibold'
              : 'text-[#9ca3af] hover:text-[#d0d5dd]'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Subscriptions</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('payments')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'payments'
              ? 'bg-[#282828] text-[#e4e7ec] font-semibold'
              : 'text-[#9ca3af] hover:text-[#d0d5dd]'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Payments &amp; Ledger</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('inquiries')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'inquiries'
              ? 'bg-[#282828] text-[#e4e7ec] font-semibold'
              : 'text-[#9ca3af] hover:text-[#d0d5dd]'
          }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>User Inquiries</span>
          {inquiryCounts.unread > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#1db954]/20 text-[#3fb970] border border-[#1db954]/30 leading-none">
              {inquiryCounts.unread}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('policies')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'policies'
              ? 'bg-[#282828] text-[#e4e7ec] font-semibold'
              : 'text-[#9ca3af] hover:text-[#d0d5dd]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Legal &amp; Policies</span>
        </button>
      </div>

      {/* ================= TAB 1: PLANS MANAGEMENT ================= */}
      {activeAdminTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#e4e7ec] font-display">
              Subscription Tiers ({plans.length} Total)
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
                className="p-5 flex flex-col justify-between relative group hover:border-[#3c3c3c]"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-purple-400 font-semibold">
                      {plan.id}
                    </span>
                    <Badge variant={plan.isActive ? 'emerald' : 'destructive'} className="text-xs">
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <h4 className="text-lg font-bold text-[#e4e7ec] font-display mb-1">
                    {plan.name}
                  </h4>
                  <p className="text-sm text-[#9ca3af] mb-4">{plan.description}</p>

                  <div className="p-3 rounded-xl bg-[#121212] border border-[#282828] mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono tabular-nums text-[#e4e7ec]">
                        ${plan.priceUsd}
                      </span>
                      <span className="text-xs text-[#9ca3af]">/mo (৳{plan.priceBdt})</span>
                    </div>
                    <div className="text-xs text-[#3fb970] font-semibold mt-1">
                      {plan.creditsGranted} Audio Minutes Granted
                    </div>
                  </div>

                  {/* Module Access Tags */}
                  <div className="mb-4">
                    <div className="text-xs uppercase font-bold text-[#9ca3af] mb-1.5 tracking-wider">
                      Module Access:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.modules && plan.modules.length > 0 ? (
                        plan.modules.map((m) => (
                          <Badge
                            key={m}
                            variant="purple"
                            className="text-xs capitalize"
                          >
                            {m.replace(/_/g, ' ')}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-[#6f7682] italic">No modules enabled</span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-1.5 text-xs text-[#d0d5dd] mb-5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#3fb970] shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-[#282828] flex items-center justify-between">
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
                    className="flex items-center gap-1 text-xs text-[#d0d5dd] hover:text-[#e4e7ec] cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Edit Plan</span>
                  </button>

                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 cursor-pointer"
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
        <div className="bg-[#181818] border border-[#282828] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
            <h3 className="text-sm font-bold text-[#e4e7ec] font-display">
              Creator Accounts & Audio Credits ({creatorUsers.length} Users)
            </h3>
            <span className="text-xs text-[#9ca3af]">Manage audio minute allowances and account status</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[#6f7682] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search creator by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9ca3af]">Status Filter:</span>
              <select
                value={userStatusFilter}
                onChange={(e: any) => setUserStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#121212] border border-[#282828] rounded-full text-xs text-[#d0d5dd] focus:outline-none focus:border-[#1db954]/60"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
            </div>
          </div>

          <div className="border border-[#282828] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121212] text-[#9ca3af] border-b border-[#282828]">
                <tr>
                  <th className="p-3">Creator Account</th>
                  <th className="p-3">Active Plan</th>
                  <th className="p-3">Audio Minutes Remaining</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282828]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-[#9ca3af]">
                      No creator accounts found matching search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    return (
                      <tr key={u.id} className="hover:bg-[#1f1f1f] transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-[#e4e7ec]">{u.name}</div>
                          <div className="text-xs text-[#9ca3af] font-mono">{u.email}</div>
                        </td>
                        <td className="p-3 font-medium text-[#d0d5dd]">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#121212] text-[#d0d5dd] border border-[#282828]">
                            {u.planName}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 font-mono tabular-nums text-xs">
                            <span className={`font-semibold ${u.creditsRemaining <= 5 ? 'text-red-400' : 'text-[#3fb970]'}`}>
                              {u.creditsRemaining}
                            </span>
                            <span className="text-[#6f7682]">
                              / {u.creditsTotal} mins
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`text-xs font-medium ${u.status === 'active' ? 'text-[#3fb970]' : 'text-red-400'}`}>
                            {u.status === 'active' ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => setSelectedUserForCredit(u)}
                            className="px-3 py-1 bg-[#1db954]/15 hover:bg-[#1db954]/25 text-[#4cc37c] rounded-full text-xs font-medium transition-colors cursor-pointer"
                          >
                            + Add Credits
                          </button>

                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                              u.status === 'active'
                                ? 'bg-red-950/60 text-red-300 hover:bg-red-900/60'
                                : 'bg-[#1db954]/15 text-[#4cc37c] hover:bg-[#1db954]/25'
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
        <div className="bg-[#181818] border border-[#282828] rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-[#e4e7ec] font-display">
            Active Subscriptions ({subscriptionsList.length} Total)
          </h3>

          <div className="border border-[#282828] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121212] text-[#9ca3af] border-b border-[#282828]">
                <tr>
                  <th className="p-3">Subscriber</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Cadence</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Next Renewal</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282828]">
                {subscriptionsList.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[#1f1f1f] transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-[#e4e7ec]">{sub.userName || 'Subscriber'}</div>
                      <div className="text-xs text-[#9ca3af] font-mono">{sub.userEmail}</div>
                    </td>
                    <td className="p-3 font-semibold text-purple-300">{sub.planName}</td>
                    <td className="p-3 uppercase font-mono text-[#9ca3af]">{sub.billingCycle}</td>
                    <td className="p-3 font-mono tabular-nums font-bold text-[#e4e7ec]">
                      ${sub.amount} {sub.currency}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-[#9ca3af]">
                      {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#1db954]/10 text-[#3fb970] border border-[#1db954]/20">
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
        <div className="bg-[#181818] border border-[#282828] rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-[#e4e7ec] font-display">
            Transaction Ledger & Invoices ({paymentsList.length} Total)
          </h3>

          <div className="border border-[#282828] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121212] text-[#9ca3af] border-b border-[#282828]">
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
              <tbody className="divide-y divide-[#282828]">
                {paymentsList.map((pay) => (
                  <tr key={pay.id} className="hover:bg-[#1f1f1f] transition-colors">
                    <td className="p-3 font-mono text-[#d0d5dd] font-semibold">{pay.transactionId}</td>
                    <td className="p-3 text-[#d0d5dd]">{pay.userEmail}</td>
                    <td className="p-3 font-medium text-[#d0d5dd]">{pay.planName}</td>
                    <td className="p-3 uppercase font-mono font-bold text-amber-400">{pay.method}</td>
                    <td className="p-3 font-mono tabular-nums font-bold text-[#e4e7ec]">${pay.amount}</td>
                    <td className="p-3 font-mono tabular-nums text-[#9ca3af]">
                      {new Date(pay.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          pay.status === 'paid'
                            ? 'bg-[#1db954]/10 text-[#3fb970] border border-[#1db954]/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
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

      {/* ================= TAB 5: USER INQUIRIES INBOX ================= */}
      {activeAdminTab === 'inquiries' && (
        <div className="bg-[#181818] border border-[#282828] rounded-2xl p-6 shadow-xl space-y-5">
          {/* Section Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#282828]">
            <div>
              <h3 className="text-sm font-bold text-[#e4e7ec] font-display flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[#3fb970]" />
                <span>User Inquiries &amp; Contact Inbox</span>
              </h3>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Incoming questions, agency quota requests, and creator support messages submitted across the platform.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'all', label: 'All', count: inquiryCounts.total },
                  { id: 'unread', label: 'Unread', count: inquiryCounts.unread },
                  { id: 'in_review', label: 'In Review', count: inquiryCounts.inReview },
                  { id: 'resolved', label: 'Resolved', count: inquiryCounts.resolved },
                ] as const
              ).map((pill) => {
                const active = inquiryStatusFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setInquiryStatusFilter(pill.id)}
                    className={`px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? 'bg-[#282828] border-[#3c3c3c] text-[#e4e7ec] font-semibold'
                        : 'bg-[#121212] border-[#282828] text-[#9ca3af] hover:text-[#d0d5dd]'
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`font-mono text-[11px] px-1.5 rounded-full ${
                        pill.id === 'unread' && pill.count > 0
                          ? 'bg-[#1db954]/15 text-[#3fb970]'
                          : 'text-[#6f7682]'
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Input */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#6f7682] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search inquiries by sender name, email, subject, or message..."
                value={inquirySearch}
                onChange={(e) => setInquirySearch(e.target.value)}
                className="pl-9 bg-[#121212] border-[#282828]"
              />
            </div>

            <div className="text-xs text-[#9ca3af]">
              Showing <span className="font-mono text-[#e4e7ec]">{filteredInquiries.length}</span> of{' '}
              <span className="font-mono text-[#e4e7ec]">{inquiriesList.length}</span> inquiries
            </div>
          </div>

          {/* Master-Detail Inbox Layout */}
          {inquiriesList.length === 0 ? (
            <div className="py-16 px-4 rounded-xl bg-[#121212] border border-[#282828] text-center space-y-2">
              <Inbox className="w-9 h-9 text-[#6f7682] mx-auto" />
              <div className="text-sm font-semibold text-[#e4e7ec]">No User Inquiries Yet</div>
              <p className="text-xs text-[#9ca3af] max-w-md mx-auto leading-relaxed">
                When visitors submit the Contact form or signed-in creators send an inquiry, their messages will appear here for review.
              </p>
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="py-14 px-4 rounded-xl bg-[#121212] border border-[#282828] text-center space-y-2">
              <Search className="w-8 h-8 text-[#6f7682] mx-auto" />
              <div className="text-sm font-semibold text-[#e4e7ec]">No Matching Inquiries</div>
              <p className="text-xs text-[#9ca3af]">
                Try clearing your search query or switching the status filter above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Inquiry List */}
              <div className="lg:col-span-5 border border-[#282828] rounded-xl bg-[#121212] divide-y divide-[#282828] max-h-[600px] overflow-y-auto">
                {filteredInquiries.map((inq) => {
                  const isSelected = selectedInquiry?.id === inq.id;
                  const statusBadge =
                    inq.status === 'unread'
                      ? { label: 'Unread', cls: 'bg-[#1db954]/15 text-[#3fb970] border-[#1db954]/30' }
                      : inq.status === 'in_review'
                      ? { label: 'In Review', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/25' }
                      : { label: 'Resolved', cls: 'bg-[#242424] text-[#9ca3af] border-[#34373f]' };

                  return (
                    <button
                      key={inq.id}
                      type="button"
                      onClick={() => handleSelectInquiry(inq)}
                      className={`w-full text-left p-4 transition-colors cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'bg-[#1f1f1f] border-l-2 border-l-[#3fb970]'
                          : 'hover:bg-[#191919]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {inq.status === 'unread' && (
                            <span className="w-2 h-2 rounded-full bg-[#3fb970] shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-[#e4e7ec] truncate">
                            {inq.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#6f7682] font-mono shrink-0">
                          {new Date(inq.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-[#9ca3af] truncate">
                          {inq.email}
                        </span>
                        <span className="text-[10px] text-[#6f7682] shrink-0">
                          {inq.source === 'creator_studio' ? 'Creator Studio' : 'Landing Form'}
                        </span>
                      </div>

                      <div className="text-xs font-medium text-[#d0d5dd] truncate">
                        {inq.subject?.trim() ? inq.subject : '(No Subject)'}
                      </div>

                      <p className="text-xs text-[#9ca3af] line-clamp-2 leading-relaxed">
                        {inq.message}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${statusBadge.cls}`}
                        >
                          {statusBadge.label}
                        </span>
                        {inq.adminNotes?.trim() && (
                          <span className="text-[10px] text-[#6f7682] flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            <span>Has Notes</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Selected Inquiry Detail & Triage */}
              {selectedInquiry && (
                <div className="lg:col-span-7 border border-[#282828] rounded-xl bg-[#121212] p-5 space-y-5">
                  {/* Sender Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#282828]">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#242424] border border-[#323232] text-[#e4e7ec] font-bold text-sm flex items-center justify-center shrink-0">
                        {selectedInquiry.name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-[#e4e7ec]">
                            {selectedInquiry.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1f1f1f] text-[#9ca3af] border border-[#2e2e2e]">
                            {selectedInquiry.source === 'creator_studio'
                              ? 'Signed-in Creator'
                              : 'Public Visitor'}
                          </span>
                        </div>
                        <a
                          href={`mailto:${selectedInquiry.email}`}
                          className="text-xs font-mono text-[#3fb970] hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Mail className="w-3 h-3" />
                          <span>{selectedInquiry.email}</span>
                        </a>
                        <div className="text-[11px] text-[#6f7682] flex items-center gap-1.5 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>Received {new Date(selectedInquiry.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Triage Status Switcher */}
                    <div className="flex items-center gap-1 p-1 bg-[#181818] border border-[#282828] rounded-full self-start">
                      {(
                        [
                          { id: 'unread', label: 'Unread' },
                          { id: 'in_review', label: 'In Review' },
                          { id: 'resolved', label: 'Resolved' },
                        ] as const
                      ).map((st) => {
                        const active = selectedInquiry.status === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            disabled={isUpdatingInquiry}
                            onClick={() =>
                              handleUpdateInquiry(
                                selectedInquiry.id,
                                { status: st.id },
                                `Inquiry marked as ${st.label}.`
                              )
                            }
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                              active
                                ? st.id === 'unread'
                                  ? 'bg-[#1db954]/20 text-[#3fb970]'
                                  : st.id === 'in_review'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-[#2c2c2c] text-[#e4e7ec]'
                                : 'text-[#9ca3af] hover:text-[#d0d5dd]'
                            }`}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subject & Full Message */}
                  <div className="p-4 rounded-xl bg-[#181818] border border-[#282828] space-y-2.5">
                    <div className="text-xs uppercase tracking-wider font-semibold text-[#6f7682]">
                      Subject
                    </div>
                    <div className="text-sm font-bold text-[#e4e7ec]">
                      {selectedInquiry.subject?.trim() || '(No Subject Provided)'}
                    </div>
                    <div className="pt-2 border-t border-[#282828] text-sm text-[#d0d5dd] whitespace-pre-wrap leading-relaxed">
                      {selectedInquiry.message}
                    </div>
                  </div>

                  {/* Internal SuperAdmin Notes */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#d0d5dd]">
                        Internal Admin Notes
                      </label>
                      <span className="text-[11px] text-[#6f7682]">
                        Private to SuperAdmin
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={inquiryNotesDraft}
                      onChange={(e) => setInquiryNotesDraft(e.target.value)}
                      placeholder="Record follow-up actions, custom plan quotes, or resolution notes..."
                      className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#282828] rounded-xl text-xs text-[#d0d5dd] placeholder-[#6f7682] focus:outline-none focus:border-[#1db954]/60"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#6f7682]">
                        Last updated {new Date(selectedInquiry.updatedAt || selectedInquiry.createdAt).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        disabled={
                          isUpdatingInquiry ||
                          inquiryNotesDraft === (selectedInquiry.adminNotes || '')
                        }
                        onClick={() =>
                          handleUpdateInquiry(
                            selectedInquiry.id,
                            { adminNotes: inquiryNotesDraft },
                            'Admin notes saved.'
                          )
                        }
                        className="px-3.5 py-1.5 rounded-full bg-[#242424] hover:bg-[#303030] disabled:opacity-40 text-xs font-semibold text-[#e4e7ec] border border-[#34373f] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5 text-[#3fb970]" />
                        <span>Save Notes</span>
                      </button>
                    </div>
                  </div>

                  {/* Action Footer: Reply via Email & Two-step Delete */}
                  <div className="pt-4 border-t border-[#282828] flex flex-wrap items-center justify-between gap-3">
                    <a
                      href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent(
                        `Re: ${selectedInquiry.subject?.trim() || 'Your Scriby Inquiry'}`
                      )}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] text-xs font-bold transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Reply via Email</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    {confirmDeleteInquiryId === selectedInquiry.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-rose-300">Delete permanently?</span>
                        <button
                          type="button"
                          disabled={isUpdatingInquiry}
                          onClick={() => handleDeleteInquiry(selectedInquiry.id)}
                          className="px-3 py-1.5 rounded-full bg-rose-950/70 hover:bg-rose-900/70 text-rose-300 border border-rose-500/30 text-xs font-semibold cursor-pointer"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteInquiryId(null)}
                          className="px-3 py-1.5 rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#d0d5dd] text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteInquiryId(selectedInquiry.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1f1f1f] hover:bg-rose-950/50 text-[#9ca3af] hover:text-rose-300 border border-[#282828] hover:border-rose-500/30 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Inquiry</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 6: LEGAL & POLICIES MANAGEMENT ================= */}
      {activeAdminTab === 'policies' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#e4e7ec] font-display flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3fb970]" />
                <span>Legal Agreements & Platform Policies</span>
              </h3>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Manage Terms & Conditions, Privacy Policy, and Refund Policy displayed dynamically on the public landing page.
              </p>
            </div>
          </div>

          {/* Policy Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(
              [
                { slug: 'terms' as PolicySlug, label: 'Terms & Conditions', sub: 'Usage rules, license & creator rights', icon: BookOpen },
                { slug: 'privacy' as PolicySlug, label: 'Privacy Policy', sub: 'Data security, storage & confidentiality', icon: ShieldCheck },
                { slug: 'refund' as PolicySlug, label: 'Refund Policy', sub: 'Payment terms & refund eligibility', icon: Scale },
              ] as const
            ).map((item) => {
              const policyData = policiesList.find((p) => p.slug === item.slug);
              const isSelected = selectedPolicySlug === item.slug;
              const IconComp = item.icon;

              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => handleSelectPolicy(item.slug)}
                  className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-950/20 border-purple-500/45 ring-1 ring-purple-500/25'
                      : 'bg-[#181818] border-[#282828] hover:bg-[#1f1f1f] hover:border-[#383838]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-purple-500/20 text-purple-400' : 'bg-[#242424] text-[#9ca3af]'}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${isSelected ? 'text-[#e4e7ec]' : 'text-[#d0d5dd]'}`}>
                          {item.label}
                        </div>
                        <div className="text-xs text-[#9ca3af]">{item.sub}</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-[#6f7682] flex items-center justify-between pt-2 border-t border-[#282828]">
                    <span>Slug: <span className="font-mono text-[#9ca3af]">{item.slug}</span></span>
                    <span>
                      {policyData?.updatedAt ? `Updated: ${new Date(policyData.updatedAt).toLocaleDateString()}` : 'Ready to save'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Policy Editor Card */}
          <Card className="p-6 bg-[#181818] border-[#282828] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#282828]">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono uppercase font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Editing: {selectedPolicySlug}
                </span>
                <span className="text-xs text-[#9ca3af]">
                  Validated before saving
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPolicyPreviewMode(!policyPreviewMode)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#383838] bg-[#242424] text-[#d0d5dd] hover:text-[#e4e7ec] hover:bg-[#2c2c2c] transition-colors cursor-pointer"
                >
                  {policyPreviewMode ? 'Switch to Markdown Editor' : 'Live Preview Formatted'}
                </button>
              </div>
            </div>

            {policyFormErrors._global && (
              <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-300">
                {policyFormErrors._global}
              </div>
            )}

            <form onSubmit={handleSavePolicy} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#d0d5dd] block mb-1.5">
                  Policy Title:
                </label>
                <input
                  type="text"
                  value={policyTitleInput}
                  onChange={(e) => setPolicyTitleInput(e.target.value)}
                  placeholder="e.g. Terms and Conditions"
                  className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#282828] rounded-xl text-xs text-[#d0d5dd] focus:outline-none focus:border-purple-500/60"
                />
                {policyFormErrors.title && (
                  <p className="text-[11px] text-red-400 mt-1">{policyFormErrors.title}</p>
                )}
              </div>

              {!policyPreviewMode ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#d0d5dd]">
                      Policy Content (Markdown & Plain Text):
                    </label>
                    <span className="text-xs text-[#6f7682] font-mono tabular-nums">
                      {policyContentInput.length} characters
                    </span>
                  </div>
                  <textarea
                    rows={16}
                    value={policyContentInput}
                    onChange={(e) => setPolicyContentInput(e.target.value)}
                    placeholder="Enter policy terms in markdown or plain text with headings (##), bullet points (- ), and bold text (**)..."
                    className="w-full px-4 py-3 bg-[#121212] border border-[#282828] rounded-xl text-sm text-[#d0d5dd] font-mono leading-relaxed focus:outline-none focus:border-[#1db954]/60"
                  />
                  {policyFormErrors.content && (
                    <p className="text-xs text-rose-400 mt-1">{policyFormErrors.content}</p>
                  )}
                  <p className="text-xs text-[#6f7682] mt-1.5">
                    Supports headings (## Title), bold text (**bold**), bullet points (- item), and paragraphs. Changes appear on the public footer modal once saved.
                  </p>
                </div>
              ) : (
                <div className="border border-[#282828] rounded-xl bg-[#121212] p-5 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#3fb970] mb-2">
                    Live Formatted Preview
                  </div>
                  <h4 className="text-lg font-bold text-[#e4e7ec] border-b border-[#282828] pb-2">
                    {policyTitleInput || 'Untitled Policy'}
                  </h4>
                  <div className="text-sm text-[#9ca3af] leading-relaxed space-y-3 whitespace-pre-wrap font-sans max-h-96 overflow-y-auto pr-2">
                    {policyContentInput}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#282828]">
                <button
                  type="button"
                  onClick={() => {
                    const found = policiesList.find((p) => p.slug === selectedPolicySlug);
                    if (found) {
                      setPolicyTitleInput(found.title);
                      setPolicyContentInput(found.content);
                    }
                    setPolicyFormErrors({});
                  }}
                  className="px-4 py-2 bg-[#242424] hover:bg-[#303030] text-[#9ca3af] hover:text-[#e4e7ec] text-xs font-semibold rounded-full transition-colors cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={isSavingPolicy}
                  className="px-5 py-2 bg-[#1db954] hover:bg-[#1aa34a] disabled:opacity-50 text-[#08100b] text-xs font-bold rounded-full transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isSavingPolicy ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Policy...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Policy</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Bonus Credit Adjustment Modal */}
      {selectedUserForCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#282828] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
            <h4 className="text-base font-bold text-[#e4e7ec] font-display mb-1 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#3fb970]" />
              <span>Grant Bonus Audio Credits</span>
            </h4>
            <p className="text-xs text-[#9ca3af] mb-4">
              Add audio minutes to {selectedUserForCredit.name}&apos;s account balance.
            </p>

            <form onSubmit={handleAddBonusCredits} className="space-y-4">
              <div>
                <label className="text-xs text-[#d0d5dd] block mb-1">Minutes to Add:</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={bonusCreditsInput}
                  onChange={(e) => setBonusCreditsInput(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-[#121212] border border-[#282828] rounded-lg text-sm font-mono text-[#d0d5dd] focus:outline-none focus:border-[#1db954]/60"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForCredit(null)}
                  className="px-3 py-1.5 bg-[#242424] hover:bg-[#2c2c2c] text-[#d0d5dd] text-xs rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] text-xs font-bold rounded-lg shadow-sm cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#282828] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#282828] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#e4e7ec] font-display">
                {editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
              </h3>
              <button
                onClick={() => setShowPlanModal(false)}
                className="p-1.5 text-[#9ca3af] hover:text-[#e4e7ec] rounded-full hover:bg-[#282828] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#9ca3af] block mb-1">Plan Name:</label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="e.g. Creator Plus"
                  className="w-full px-3.5 py-2 bg-[#121212] border border-[#282828] rounded-xl text-sm text-[#d0d5dd] focus:outline-none focus:border-[#1db954]/60"
                />
                {planFormErrors.name && (
                  <p className="text-xs text-rose-400 mt-1">{planFormErrors.name}</p>
                )}
              </div>

              <div>
                <label className="text-xs text-[#9ca3af] block mb-1">Description:</label>
                <input
                  type="text"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="e.g. Best for growing YouTube creators..."
                  className="w-full px-3.5 py-2 bg-[#121212] border border-[#282828] rounded-xl text-sm text-[#d0d5dd] focus:outline-none focus:border-[#1db954]/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9ca3af] block mb-1">Price (USD $):</label>
                  <input
                    type="number"
                    value={planForm.priceUsd}
                    onChange={(e) => setPlanForm({ ...planForm, priceUsd: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-[#121212] border border-[#282828] rounded-xl text-sm text-[#d0d5dd] font-mono focus:outline-none focus:border-[#1db954]/60"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9ca3af] block mb-1">Audio Credits (Minutes):</label>
                  <input
                    type="number"
                    value={planForm.creditsGranted}
                    onChange={(e) => setPlanForm({ ...planForm, creditsGranted: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3.5 py-2 bg-[#121212] border border-[#282828] rounded-xl text-sm text-[#d0d5dd] font-mono focus:outline-none focus:border-[#1db954]/60"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9ca3af] block mb-1">Features List (One item per line):</label>
                <textarea
                  rows={3}
                  value={planForm.featuresText}
                  onChange={(e) => setPlanForm({ ...planForm, featuresText: e.target.value })}
                  placeholder="SRT Subtitles&#10;AI YouTube Titles&#10;16:9 HD Thumbnails"
                  className="w-full px-3.5 py-2 bg-[#121212] border border-[#282828] rounded-xl text-sm text-[#d0d5dd] focus:outline-none focus:border-[#1db954]/60 leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="text-xs text-[#9ca3af] block mb-1.5 font-semibold">
                  Module-Wise Access Permissions:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-[#121212] border border-[#282828] rounded-xl">
                  {AVAILABLE_MODULES.map((mod) => {
                    const isChecked = planForm.modules.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-[#1db954]/10 border-[#1db954]/40 text-[#e4e7ec]'
                            : 'bg-[#181818] border-[#282828] text-[#9ca3af] hover:text-[#d0d5dd]'
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
                          className="mt-0.5 rounded border-[#383838] accent-[#1db954] cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-[#e4e7ec]">{mod.label}</div>
                          <div className="text-xs text-[#9ca3af] leading-snug">{mod.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#282828]">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 bg-[#282828] hover:bg-[#383838] text-[#d0d5dd] text-xs font-semibold rounded-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1db954] hover:bg-[#1aa34a] text-[#08100b] text-xs font-bold rounded-full transition-all cursor-pointer"
                >
                  {editingPlan ? 'Update Plan' : 'Save Subscription Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
