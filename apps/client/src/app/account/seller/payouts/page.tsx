"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  DollarSign,
  Clock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ArrowUpRight,
  Lock,
  Building2,
  RefreshCw,
  AlertCircle,
  Store,
  ChevronLeft,
  XCircle,
  Coins,
} from "lucide-react";
import { getMyVendor, type ClientVendor } from "@/services/vendor.service";
import {
  fetchVendorBalance,
  fetchEscrowTransactions,
  fetchPayoutRequests,
  requestVendorPayout,
} from "@/services/settlement.service";
import type {
  VendorBalance,
  VendorEscrowTransaction,
  VendorPayoutRequest,
  EscrowStatus,
  PayoutStatus,
  PayoutMethod,
} from "@repo/types";

export default function MerchantPayoutsPage(): React.JSX.Element {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<ClientVendor | null>(null);
  const [balance, setBalance] = useState<VendorBalance | null>(null);
  const [escrows, setEscrows] = useState<VendorEscrowTransaction[]>([]);
  const [payouts, setPayouts] = useState<VendorPayoutRequest[]>([]);

  // Filter & Pagination
  const [escrowFilter, setEscrowFilter] = useState<EscrowStatus | "ALL">("ALL");
  const [activeTab, setActiveTab] = useState<"escrow" | "payouts">("escrow");

  // Payout Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(5000);
  const [withdrawMethod, setWithdrawMethod] =
    useState<PayoutMethod>("BANK_TRANSFER");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = (await getToken()) || undefined;
      const myVendor = await getMyVendor(token);
      if (!myVendor) {
        setVendor(null);
        return;
      }
      setVendor(myVendor);

      const [balanceData, escrowRes, payoutRes] = await Promise.all([
        fetchVendorBalance(myVendor.id, token).catch(() => null),
        fetchEscrowTransactions(
          myVendor.id,
          {
            status: escrowFilter === "ALL" ? undefined : escrowFilter,
            limit: 20,
          },
          token,
        ).catch(() => ({ transactions: [] })),
        fetchPayoutRequests(myVendor.id, { limit: 20 }, token).catch(() => ({
          requests: [],
        })),
      ]);

      setBalance(balanceData);
      setEscrows(escrowRes.transactions);
      setPayouts(payoutRes.requests);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load settlement data";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [getToken, escrowFilter]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadData();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, loadData]);

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;

    if (!balance || balance.availableBalance < 5000) {
      toast.error(
        "Available balance must be at least 5,000 PKR to request a payout.",
      );
      return;
    }

    if (withdrawAmount > balance.availableBalance) {
      toast.error("Withdrawal amount cannot exceed your available balance.");
      return;
    }

    if (withdrawAmount < 5000) {
      toast.error("Minimum payout request is 5,000 PKR.");
      return;
    }

    try {
      setIsSubmitting(true);
      const token = (await getToken()) || undefined;
      await requestVendorPayout(
        vendor.id,
        {
          amount: withdrawAmount,
          currency: balance.currency,
          paymentMethod: withdrawMethod,
          notes: withdrawNotes.trim() ? withdrawNotes.trim() : undefined,
        },
        token,
      );

      toast.success(
        "Payout request submitted successfully for settlement processing.",
      );
      setIsModalOpen(false);
      setWithdrawNotes("");
      loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to submit payout request.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateDaysRemaining = (dueDateStr?: string | null) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderEscrowBadge = (status: EscrowStatus) => {
    switch (status) {
      case "HELD_IN_ESCROW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3 h-3" /> In Escrow
          </span>
        );
      case "RELEASED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Released
          </span>
        );
      case "DISPUTE_FROZEN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <ShieldAlert className="w-3 h-3" /> Frozen / Review
          </span>
        );
      case "REFUNDED_RETURN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <XCircle className="w-3 h-3" /> Returned / Reversed
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const renderPayoutBadge = (status: PayoutStatus) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Pending Review
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <RefreshCw className="w-3 h-3 animate-spin" /> Batch Processing
          </span>
        );
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Settled & Paid
          </span>
        );
      case "REJECTED":
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> {status}
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">
          Loading merchant ledger and escrow accounts...
        </p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
        <Lock className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">
          Merchant Sign-In Required
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Please sign in to access your vendor settlement account and payout
          controls.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
        >
          Sign In to Continue
        </Link>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
        <Store className="w-14 h-14 text-indigo-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">
          No Registered Vendor Account
        </h2>
        <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
          You have not registered an active legal merchant entity yet. Complete
          our seamless merchant onboarding to start selling and accessing
          automated payout ledgers.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/become-a-seller"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
          >
            Register as a Seller <ArrowUpRight className="w-4 h-4" />
          </Link>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-sm transition-colors"
          >
            Back to Account
          </Link>
        </div>
      </div>
    );
  }

  const currency = balance?.currency || "PKR";
  const canRequestPayout = Boolean(balance && balance.availableBalance >= 5000);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors mb-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Customer Account
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-indigo-400" />
            {vendor.legalName}
            <span className="text-xs font-normal px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Escrow & Settlements
            </span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Authoritative double-entry ledger with automated 7-day post-delivery
            escrow protection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!canRequestPayout}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg ${
              canRequestPayout
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
            }`}
          >
            <Coins className="w-4 h-4" />
            Request Payout
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Available Balance */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Available for Withdrawal</span>
            <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {currency}{" "}
            {balance
              ? balance.availableBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })
              : "0.00"}
          </div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Liquid balance (Min: 5,000{" "}
            {currency})
          </div>
        </div>

        {/* Card 2: Escrow Buffer (Return Protection) */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-amber-500/30 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Held in Escrow</span>
            <span className="p-1 rounded-lg bg-amber-500/20 text-amber-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {currency}{" "}
            {balance
              ? balance.escrowBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })
              : "0.00"}
          </div>
          <div className="mt-2 text-xs text-amber-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> 7-day post-delivery buffer
          </div>
        </div>

        {/* Card 3: Dispute Frozen */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Dispute & Hold Hold</span>
            <span className="p-1 rounded-lg bg-rose-500/20 text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {currency}{" "}
            {balance
              ? balance.disputeFrozenBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })
              : "0.00"}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Frozen during active investigations
          </div>
        </div>

        {/* Card 4: Lifetime Disbursed */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Lifetime Disbursed</span>
            <span className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {currency}{" "}
            {balance
              ? balance.lifetimePaid.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })
              : "0.00"}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Total historical payouts settled
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("escrow")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "escrow"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          Escrow Protection Ledger ({escrows.length})
        </button>
        <button
          onClick={() => setActiveTab("payouts")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "payouts"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Coins className="w-4 h-4" />
          Payout Requests & Batches ({payouts.length})
        </button>
      </div>

      {/* Tab 1: Escrow Ledger */}
      {activeTab === "escrow" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">
              Showing recent escrow order transactions and their scheduled
              maturity release dates.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Filter:</span>
              <select
                value={escrowFilter}
                onChange={(e) =>
                  setEscrowFilter(e.target.value as EscrowStatus | "ALL")
                }
                className="bg-zinc-900 border border-zinc-800 text-xs rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Transactions</option>
                <option value="HELD_IN_ESCROW">Held in Escrow</option>
                <option value="RELEASED">Released to Balance</option>
                <option value="DISPUTE_FROZEN">Dispute Frozen</option>
                <option value="REFUNDED_RETURN">Returned / Reversed</option>
              </select>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-4">Gross Sales</th>
                    <th className="py-3.5 px-4">Commission</th>
                    <th className="py-3.5 px-4">Net Payout</th>
                    <th className="py-3.5 px-4">Delivered At</th>
                    <th className="py-3.5 px-4">Maturity / Buffer</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {escrows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-zinc-500 text-sm"
                      >
                        No escrow transactions found in this state.
                      </td>
                    </tr>
                  ) : (
                    escrows.map((tx) => {
                      const daysLeft = calculateDaysRemaining(tx.releaseDueAt);
                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-medium text-white">
                            #{tx.orderId.slice(-8)}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-zinc-200">
                            {tx.currency} {tx.grossAmount.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400">
                            {tx.commissionRate}% (-{tx.currency}{" "}
                            {tx.commissionAmount.toFixed(2)})
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-400">
                            {tx.currency} {tx.netAmount.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400">
                            {tx.deliveredAt
                              ? new Date(tx.deliveredAt).toLocaleDateString()
                              : "In Transit"}
                          </td>
                          <td className="py-3.5 px-4">
                            {tx.status === "HELD_IN_ESCROW" &&
                            daysLeft !== null ? (
                              daysLeft > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  <Clock className="w-3 h-3" /> Matures in{" "}
                                  {daysLeft}d
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> Ready to
                                  Release
                                </span>
                              )
                            ) : tx.status === "RELEASED" ? (
                              <span className="text-zinc-500 text-xs">
                                Settled on{" "}
                                {tx.releasedAt
                                  ? new Date(tx.releasedAt).toLocaleDateString()
                                  : "Completed"}
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {renderEscrowBadge(tx.status)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Payout Requests */}
      {activeTab === "payouts" && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">
            Complete record of automated batch disbursements and on-demand
            payout requests.
          </p>

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Requested Date</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Disbursement Method</th>
                    <th className="py-3.5 px-4">Beneficiary Account</th>
                    <th className="py-3.5 px-4">Reference</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {payouts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-zinc-500 text-sm"
                      >
                        No payout requests or historical disbursements recorded
                        yet.
                      </td>
                    </tr>
                  ) : (
                    payouts.map((req) => (
                      <tr
                        key={req.id}
                        className="hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 text-zinc-400">
                          {new Date(req.requestedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white text-base">
                          {req.currency} {req.amount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-zinc-300">
                            {req.paymentMethod.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400">
                          {req.bankName ? (
                            <div>
                              <div className="font-semibold text-zinc-200">
                                {req.bankName}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-400">
                                {req.accountNumberOrIban}
                              </div>
                            </div>
                          ) : (
                            <span className="text-zinc-500">
                              Verified Profile Account
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-zinc-400">
                          {req.transactionReference || "Pending Execution"}
                        </td>
                        <td className="py-3.5 px-4">
                          {renderPayoutBadge(req.status)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payout Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                Request Payout Withdrawal
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Withdrawal Amount ({currency})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={5000}
                    max={balance?.availableBalance || 5000}
                    step={100}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500 text-lg"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setWithdrawAmount(balance?.availableBalance || 5000)
                    }
                    className="absolute right-3 top-2.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Available: {currency}{" "}
                  {balance?.availableBalance.toLocaleString() || "0"} (Min:
                  5,000 {currency})
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Disbursement Rails
                </label>
                <select
                  value={withdrawMethod}
                  onChange={(e) =>
                    setWithdrawMethod(e.target.value as PayoutMethod)
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="BANK_TRANSFER">
                    Direct IBAN Bank Transfer (1-2 Business Days)
                  </option>
                  <option value="RAAST_INSTANT">
                    Raast Instant Settlement (Same-Day)
                  </option>
                  <option value="STRIPE_CONNECT">Stripe Connect Express</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Settlement Notes / Reference (Optional)
                </label>
                <textarea
                  rows={2}
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="Optional internal reference notes for this withdrawal..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Disbursements are issued to your verified KYB business bank
                  account on file. Withdrawals are audited for compliance before
                  bank batch dispatch.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Confirm Withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
