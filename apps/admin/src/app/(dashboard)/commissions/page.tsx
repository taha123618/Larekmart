"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchCommissionPlans,
  fetchCommissionRules,
  fetchCommissionRuleVersions,
  fetchCommissionReports,
  createCommissionPlan,
  createCommissionRule,
  updateCommissionRule,
  type AdminCommissionPlan,
  type AdminCommissionRule,
  type AdminCommissionRuleVersion,
  type CreatePlanInput,
  type CreateRuleInput,
  type UpdateRuleInput,
} from "@/services/commission.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Percent,
  TrendingUp,
  Store,
  Layers,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Edit2,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { toast } from "react-toastify";

export default function AdminCommissionsPage(): React.JSX.Element {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"rules" | "versions" | "reports">("rules");

  // Create Plan Sheet
  const [isPlanSheetOpen, setIsPlanSheetOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDesc, setNewPlanDesc] = useState("");
  const [newPlanIsDefault, setNewPlanIsDefault] = useState(false);

  // Create Rule Sheet
  const [isRuleSheetOpen, setIsRuleSheetOpen] = useState(false);
  const [rulePlanId, setRulePlanId] = useState("");
  const [ruleScope, setRuleScope] = useState<"GLOBAL" | "SELLER" | "CATEGORY" | "PRODUCT">("GLOBAL");
  const [ruleScopeId, setRuleScopeId] = useState("");
  const [rulePercent, setRulePercent] = useState<number>(8.0);
  const [ruleFixed, setRuleFixed] = useState<number>(0);
  const [ruleMin, setRuleMin] = useState<string>("10");
  const [ruleMax, setRuleMax] = useState<string>("");
  const [rulePriority, setRulePriority] = useState<number>(0);

  // Edit Rule Sheet
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AdminCommissionRule | null>(null);
  const [editPercent, setEditPercent] = useState<number>(0);
  const [editFixed, setEditFixed] = useState<number>(0);
  const [editMin, setEditMin] = useState<string>("");
  const [editMax, setEditMax] = useState<string>("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editReason, setEditReason] = useState("");

  // Queries
  const plansQuery = useQuery({
    queryKey: ["admin-commission-plans"],
    queryFn: async () => {
      const token = (await getToken()) || undefined;
      return fetchCommissionPlans(token);
    },
  });

  const rulesQuery = useQuery({
    queryKey: ["admin-commission-rules"],
    queryFn: async () => {
      const token = (await getToken()) || undefined;
      return fetchCommissionRules(token);
    },
  });

  const versionsQuery = useQuery({
    queryKey: ["admin-commission-versions"],
    queryFn: async () => {
      const token = (await getToken()) || undefined;
      return fetchCommissionRuleVersions(token);
    },
    enabled: activeTab === "versions",
  });

  const reportsQuery = useQuery({
    queryKey: ["admin-commission-reports"],
    queryFn: async () => {
      const token = (await getToken()) || undefined;
      return fetchCommissionReports(token);
    },
  });

  // Mutations
  const createPlanMutation = useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      const token = (await getToken()) || undefined;
      return createCommissionPlan(input, token);
    },
    onSuccess: () => {
      toast.success("Commission plan created successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-commission-plans"] });
      setIsPlanSheetOpen(false);
      setNewPlanName("");
      setNewPlanDesc("");
      setNewPlanIsDefault(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create commission plan";
      toast.error(msg);
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      const token = (await getToken()) || undefined;
      return createCommissionRule(input, token);
    },
    onSuccess: () => {
      toast.success("Commission rule added successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-commission-rules"] });
      setIsRuleSheetOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to add commission rule";
      toast.error(msg);
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ ruleId, input }: { ruleId: string; input: UpdateRuleInput }) => {
      const token = (await getToken()) || undefined;
      return updateCommissionRule(ruleId, input, token);
    },
    onSuccess: () => {
      toast.success("Commission rule updated with version snapshot recorded.");
      queryClient.invalidateQueries({ queryKey: ["admin-commission-rules"] });
      queryClient.invalidateQueries({ queryKey: ["admin-commission-versions"] });
      setIsEditSheetOpen(false);
      setEditingRule(null);
      setEditReason("");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update rule";
      toast.error(msg);
    },
  });

  const openEditModal = (rule: AdminCommissionRule) => {
    setEditingRule(rule);
    setEditPercent(Number(rule.percentageRate));
    setEditFixed(Number(rule.fixedAmount));
    setEditMin(rule.minCommission != null ? String(rule.minCommission) : "");
    setEditMax(rule.maxCommission != null ? String(rule.maxCommission) : "");
    setEditStatus(rule.status);
    setEditReason("");
    setIsEditSheetOpen(true);
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) {
      toast.error("Plan name is required");
      return;
    }
    createPlanMutation.mutate({
      name: newPlanName.trim(),
      description: newPlanDesc.trim() || undefined,
      isDefault: newPlanIsDefault,
    });
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPlanId = rulePlanId || plansQuery.data?.[0]?.id || "plan_default_marketplace";
    createRuleMutation.mutate({
      planId: targetPlanId,
      ruleType: "PERCENTAGE",
      scope: ruleScope,
      scopeId: ruleScopeId.trim() || null,
      percentageRate: rulePercent,
      fixedAmount: ruleFixed,
      minCommission: ruleMin ? Number(ruleMin) : null,
      maxCommission: ruleMax ? Number(ruleMax) : null,
      priority: rulePriority,
    });
  };

  const handleUpdateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    if (!editReason.trim()) {
      toast.error("Audit change reason is required for versioning.");
      return;
    }
    updateRuleMutation.mutate({
      ruleId: editingRule.id,
      input: {
        percentageRate: editPercent,
        fixedAmount: editFixed,
        minCommission: editMin ? Number(editMin) : null,
        maxCommission: editMax ? Number(editMax) : null,
        status: editStatus,
        changeReason: editReason.trim(),
      },
    });
  };

  const reports = reportsQuery.data;
  const plans = plansQuery.data || [];
  const rules = rulesQuery.data || [];
  const versions = versionsQuery.data || [];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Percent className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Marketplace Commissions</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Authoritative commission plans, tiered rules, version snapshots, and fee breakdowns.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["admin-commission-plans"] });
              queryClient.invalidateQueries({ queryKey: ["admin-commission-rules"] });
              queryClient.invalidateQueries({ queryKey: ["admin-commission-reports"] });
              toast.info("Refreshed commission data.");
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPlanSheetOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Plan
          </Button>

          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => setIsRuleSheetOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Commission Collected
            </CardTitle>
            <Percent className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              PKR {(reports?.summary.totalCommissionRevenue || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Authoritative ledger commission receipts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orders Processed
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(reports?.summary.totalOrdersProcessed || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total order line calculations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Plans & Rules
            </CardTitle>
            <Layers className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans.length} Plans / {rules.length} Rules
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active configuration hierarchy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sellers Commissioned
            </CardTitle>
            <Store className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(reports?.summary.activeSellersCount || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unique merchants settled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Control */}
      <div className="flex border-b space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("rules")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "rules"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          Plans & Rules ({rules.length})
        </button>

        <button
          onClick={() => setActiveTab("versions")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "versions"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="w-4 h-4" />
          Version Audit Trail
        </button>

        <button
          onClick={() => setActiveTab("reports")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "reports"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Seller Commission Analytics
        </button>
      </div>

      {/* TAB 1: PLANS & RULES */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          {/* Active Plans Sub-Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Card key={plan.id} className={plan.isDefault ? "border-indigo-500/50 bg-indigo-500/5" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{plan.name}</CardTitle>
                    {plan.isDefault && (
                      <Badge className="bg-indigo-600 text-white text-xs">DEFAULT</Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs line-clamp-2">
                    {plan.description || "Marketplace plan configuration"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex justify-between items-center pt-0">
                  <span>ID: {plan.id}</span>
                  <Badge variant="outline">{plan.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Rules Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Commission Resolution Rules</CardTitle>
              <CardDescription>
                Resolved in strict priority hierarchy: PRODUCT &gt; SELLER &gt; CATEGORY &gt; GLOBAL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    <TableHead>Target ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Rate (%)</TableHead>
                    <TableHead>Fixed Fee</TableHead>
                    <TableHead>Min / Max Limit</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Loading commission rules...
                      </TableCell>
                    </TableRow>
                  ) : rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No commission rules configured.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              rule.scope === "GLOBAL"
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                : rule.scope === "SELLER"
                                ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                : rule.scope === "CATEGORY"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            }
                          >
                            {rule.scope}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {rule.scopeId || "All Marketplace"}
                        </TableCell>
                        <TableCell className="text-xs">{rule.ruleType}</TableCell>
                        <TableCell className="font-semibold text-sm">
                          {Number(rule.percentageRate).toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-xs">
                          PKR {Number(rule.fixedAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {rule.minCommission ? `Min: PKR ${rule.minCommission}` : "None"}
                          {rule.maxCommission ? ` / Max: PKR ${rule.maxCommission}` : ""}
                        </TableCell>
                        <TableCell className="text-xs">{rule.priority}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              rule.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-zinc-500/10 text-zinc-500"
                            }
                          >
                            {rule.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(rule)}
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: AUDIT TRAIL / RULE VERSIONS */}
      {activeTab === "versions" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Immutable Rule Version History</CardTitle>
            <CardDescription>
              Every rule change automatically archives a point-in-time snapshot with reason and user signature.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule ID</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead>Audit Reason</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead className="text-right">Snapshot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versionsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading version snapshots...
                    </TableCell>
                  </TableRow>
                ) : versions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No previous version records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  versions.map((ver) => (
                    <TableRow key={ver.id}>
                      <TableCell className="font-mono text-xs">{ver.ruleId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">v{ver.version}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{ver.changedBy}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {ver.changeReason}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(ver.validFrom).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {JSON.stringify(ver.ruleSnapshot).slice(0, 40)}...
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: SELLER COMMISSION ANALYTICS */}
      {activeTab === "reports" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seller Commission Breakdown</CardTitle>
            <CardDescription>
              Settled order volume, total fees collected, and net merchant payouts per vendor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller ID</TableHead>
                  <TableHead>Total Orders</TableHead>
                  <TableHead>Gross Merchandise Volume</TableHead>
                  <TableHead>Commission Collected</TableHead>
                  <TableHead>Effective Fee (%)</TableHead>
                  <TableHead className="text-right">Net Seller Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading report analytics...
                    </TableCell>
                  </TableRow>
                ) : !reports || reports.sellerBreakdown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No settled commissions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.sellerBreakdown.map((row) => {
                    const effectiveFee =
                      row.grossSubtotal > 0
                        ? ((row.commissionCollected / row.grossSubtotal) * 100).toFixed(2)
                        : "0.00";
                    return (
                      <TableRow key={row.sellerId}>
                        <TableCell className="font-mono text-xs font-medium">
                          {row.sellerId}
                        </TableCell>
                        <TableCell className="text-xs">{row.orderCount}</TableCell>
                        <TableCell className="font-semibold text-xs">
                          PKR {row.grossSubtotal.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-emerald-600 font-medium">
                          PKR {row.commissionCollected.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline">{effectiveFee}%</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-xs text-indigo-600">
                          PKR {row.netPayout.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* CREATE PLAN SHEET */}
      <Sheet open={isPlanSheetOpen} onOpenChange={setIsPlanSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create Commission Plan</SheetTitle>
            <SheetDescription>
              Create a named set of commission rules for the marketplace.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreatePlan} className="space-y-4 mt-6">
            <div>
              <label className="text-xs font-medium">Plan Name</label>
              <Input
                placeholder="e.g. Standard Marketplace 2026"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <Input
                placeholder="e.g. Default platform rates across all product categories"
                value={newPlanDesc}
                onChange={(e) => setNewPlanDesc(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={newPlanIsDefault}
                onChange={(e) => setNewPlanIsDefault(e.target.checked)}
                className="rounded border-zinc-300"
              />
              <label htmlFor="isDefault" className="text-xs font-medium">
                Set as Default Active Marketplace Plan
              </label>
            </div>
            <Button
              type="submit"
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={createPlanMutation.isPending}
            >
              {createPlanMutation.isPending ? "Creating..." : "Create Plan"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* CREATE RULE SHEET */}
      <Sheet open={isRuleSheetOpen} onOpenChange={setIsRuleSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add Commission Rule</SheetTitle>
            <SheetDescription>
              Configure granular commission fees by Scope, Rate, and Caps.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateRule} className="space-y-4 mt-6">
            <div>
              <label className="text-xs font-medium">Plan</label>
              <select
                className="w-full border rounded-md p-2 text-xs bg-background"
                value={rulePlanId}
                onChange={(e) => setRulePlanId(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isDefault ? "(Default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium">Scope</label>
              <select
                className="w-full border rounded-md p-2 text-xs bg-background"
                value={ruleScope}
                onChange={(e) =>
                  setRuleScope(e.target.value as "GLOBAL" | "SELLER" | "CATEGORY" | "PRODUCT")
                }
              >
                <option value="GLOBAL">GLOBAL (All Marketplace)</option>
                <option value="CATEGORY">CATEGORY (Specific Category)</option>
                <option value="SELLER">SELLER (Specific Merchant)</option>
                <option value="PRODUCT">PRODUCT (Single SKU Override)</option>
              </select>
            </div>

            {ruleScope !== "GLOBAL" && (
              <div>
                <label className="text-xs font-medium">Scope Identifier (Target ID)</label>
                <Input
                  placeholder="e.g. cat_electronics or seller_42"
                  value={ruleScopeId}
                  onChange={(e) => setRuleScopeId(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Percentage Rate (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={rulePercent}
                  onChange={(e) => setRulePercent(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Fixed Fee (PKR)</label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={ruleFixed}
                  onChange={(e) => setRuleFixed(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Min Cap (PKR)</label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={ruleMin}
                  onChange={(e) => setRuleMin(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Max Cap (PKR)</label>
                <Input
                  type="number"
                  placeholder="Optional cap"
                  value={ruleMax}
                  onChange={(e) => setRuleMax(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Priority (Higher wins ties)</label>
              <Input
                type="number"
                value={rulePriority}
                onChange={(e) => setRulePriority(Number(e.target.value))}
              />
            </div>

            <Button
              type="submit"
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={createRuleMutation.isPending}
            >
              {createRuleMutation.isPending ? "Adding..." : "Add Commission Rule"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* EDIT RULE SHEET */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Commission Rule</SheetTitle>
            <SheetDescription>
              Changes are version-controlled with an immutable snapshot archived.
            </SheetDescription>
          </SheetHeader>
          {editingRule && (
            <form onSubmit={handleUpdateRule} className="space-y-4 mt-6">
              <div className="p-3 bg-muted rounded-md text-xs space-y-1">
                <div>
                  <span className="font-semibold">Rule ID:</span> {editingRule.id}
                </div>
                <div>
                  <span className="font-semibold">Scope:</span> {editingRule.scope} (
                  {editingRule.scopeId || "GLOBAL"})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Percentage Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editPercent}
                    onChange={(e) => setEditPercent(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Fixed Fee (PKR)</label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={editFixed}
                    onChange={(e) => setEditFixed(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Min Cap (PKR)</label>
                  <Input
                    type="number"
                    value={editMin}
                    onChange={(e) => setEditMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Max Cap (PKR)</label>
                  <Input
                    type="number"
                    value={editMax}
                    onChange={(e) => setEditMax(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Status</label>
                <select
                  className="w-full border rounded-md p-2 text-xs bg-background"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-rose-600">
                  Audit Change Reason (Required for Versioning) *
                </label>
                <Input
                  placeholder="e.g. Q4 holiday fee adjustment for electronics category"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={updateRuleMutation.isPending}
              >
                {updateRuleMutation.isPending ? "Saving..." : "Save Changes & Snapshot"}
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
