"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAdminTaxOverview,
  fetchAdminTaxRules,
  createAdminTaxRule,
  activateAdminTaxRule,
  deactivateAdminTaxRule,
  fetchAdminTaxJurisdictions,
  createAdminTaxJurisdiction,
  fetchAdminTaxCategories,
  createAdminTaxCategory,
  fetchAdminTaxExemptions,
  createAdminTaxExemption,
  fetchAdminTaxCalculations,
} from "@/services/tax.service";
import type {
  CreateTaxRuleInput,
  CreateTaxJurisdictionInput,
  CreateTaxCategoryInput,
  CreateTaxExemptionInput,
} from "@repo/types";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Scale,
  Globe2,
  Percent,
  FileCheck2,
  Receipt,
  Search,
  RefreshCw,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Tag,
  Layers,
  History,
  Activity,
} from "lucide-react";
import { fetchCommerceAnalytics } from "@/services/analytics.service";

type ActiveTab =
  | "rules"
  | "jurisdictions"
  | "categories"
  | "exemptions"
  | "audits";

export default function TaxesAdminDashboardPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("rules");
  const [search, setSearch] = useState("");

  // Create Rule Sheet State
  const [isRuleSheetOpen, setIsRuleSheetOpen] = useState(false);
  const [ruleJurisdictionId, setRuleJurisdictionId] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [ruleRatePercent, setRuleRatePercent] = useState("8.25");
  const [ruleIsInclusive, setRuleIsInclusive] = useState(false);
  const [rulePriority, setRulePriority] = useState(1);
  const [ruleVersion, setRuleVersion] = useState("2026-10");

  // Create Jurisdiction Sheet State
  const [isJurisdictionSheetOpen, setIsJurisdictionSheetOpen] = useState(false);
  const [jurCountryCode, setJurCountryCode] = useState("US");
  const [jurRegionCode, setJurRegionCode] = useState("CA");
  const [jurMunicipality, setJurMunicipality] = useState("");
  const [jurCode, setJurCode] = useState("US-CA");
  const [jurName, setJurName] = useState("California State");

  // Create Category Sheet State
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [catCode, setCatCode] = useState("clothing");
  const [catName, setCatName] = useState("Apparel & Clothing");
  const [catDesc, setCatDesc] = useState(
    "Apparel, shoes, and wearable garments",
  );

  // Create Exemption Sheet State
  const [isExemptionSheetOpen, setIsExemptionSheetOpen] = useState(false);
  const [exemptCustId, setExemptCustId] = useState("");
  const [exemptCert, setExemptCert] = useState("CERT-RESALE-1001");
  const [exemptType, setExemptType] = useState<
    "wholesale" | "government" | "diplomatic" | "charity" | "educational"
  >("wholesale");

  // Overview Query
  const {
    data: overview,
    isLoading: isOverviewLoading,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ["admin-tax-overview"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminTaxOverview(token ?? undefined);
    },
  });

  // Live Commerce Analytics Telemetry (Go analytic-service :8004)
  const { data: commerceAnalytics, refetch: refetchCommerce } = useQuery({
    queryKey: ["admin-commerce-analytics"],
    queryFn: async () => {
      const token = await getToken();
      return fetchCommerceAnalytics(token ?? undefined);
    },
    staleTime: 30000,
  });

  // Rules Query
  const {
    data: rules,
    isLoading: isRulesLoading,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ["admin-tax-rules"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminTaxRules(token ?? undefined);
    },
  });

  // Jurisdictions Query
  const {
    data: jurisdictions,
    isLoading: isJurLoading,
    refetch: refetchJur,
  } = useQuery({
    queryKey: ["admin-tax-jurisdictions"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminTaxJurisdictions(token ?? undefined);
    },
  });

  // Categories Query
  const {
    data: categories,
    isLoading: isCatLoading,
    refetch: refetchCat,
  } = useQuery({
    queryKey: ["admin-tax-categories"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminTaxCategories(token ?? undefined);
    },
  });

  // Exemptions Query
  const {
    data: exemptions,
    isLoading: isExemptLoading,
    refetch: refetchExempt,
  } = useQuery({
    queryKey: ["admin-tax-exemptions"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminTaxExemptions(token ?? undefined);
    },
  });

  // Calculations Query
  const {
    data: calculations,
    isLoading: isCalcLoading,
    refetch: refetchCalc,
  } = useQuery({
    queryKey: ["admin-tax-calculations"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminTaxCalculations(token ?? undefined);
    },
  });

  // Mutations
  const createRuleMutation = useMutation({
    mutationFn: async (payload: CreateTaxRuleInput) => {
      const token = await getToken();
      return createAdminTaxRule(payload, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tax-rules"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tax-overview"] });
      setIsRuleSheetOpen(false);
    },
  });

  const activateRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const token = await getToken();
      return activateAdminTaxRule(ruleId, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tax-rules"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tax-overview"] });
    },
  });

  const deactivateRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const token = await getToken();
      return deactivateAdminTaxRule(ruleId, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tax-rules"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tax-overview"] });
    },
  });

  const createJurMutation = useMutation({
    mutationFn: async (payload: CreateTaxJurisdictionInput) => {
      const token = await getToken();
      return createAdminTaxJurisdiction(payload, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tax-jurisdictions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tax-overview"] });
      setIsJurisdictionSheetOpen(false);
    },
  });

  const createCatMutation = useMutation({
    mutationFn: async (payload: CreateTaxCategoryInput) => {
      const token = await getToken();
      return createAdminTaxCategory(payload, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tax-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tax-overview"] });
      setIsCategorySheetOpen(false);
    },
  });

  const createExemptMutation = useMutation({
    mutationFn: async (payload: CreateTaxExemptionInput) => {
      const token = await getToken();
      return createAdminTaxExemption(payload, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tax-exemptions"] });
      setIsExemptionSheetOpen(false);
    },
  });

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleJurisdictionId || !ruleCategoryId) return;

    // Convert percentage e.g. "8.25" to decimal rate string "0.0825"
    const rateDecimal = (parseFloat(ruleRatePercent) / 100).toFixed(6);

    createRuleMutation.mutate({
      jurisdictionId: ruleJurisdictionId,
      categoryId: ruleCategoryId,
      rate: rateDecimal,
      isInclusive: ruleIsInclusive,
      priority: Number(rulePriority),
      version: ruleVersion,
      calculationMethod: "percentage",
      effectiveFrom: new Date().toISOString(),
      isActive: true,
    });
  };

  const handleCreateJurisdiction = (e: React.FormEvent) => {
    e.preventDefault();
    createJurMutation.mutate({
      countryCode: jurCountryCode.toUpperCase(),
      regionCode: jurRegionCode.trim().toUpperCase() || undefined,
      municipality: jurMunicipality.trim() || undefined,
      jurisdictionCode: jurCode.trim().toUpperCase(),
      name: jurName.trim(),
      isActive: true,
    });
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    createCatMutation.mutate({
      code: catCode.trim().toLowerCase(),
      name: catName.trim(),
      description: catDesc.trim() || undefined,
      isActive: true,
    });
  };

  const handleCreateExemption = (e: React.FormEvent) => {
    e.preventDefault();
    createExemptMutation.mutate({
      customerId: exemptCustId.trim() || undefined,
      exemptionCertificate: exemptCert.trim(),
      exemptionType: exemptType,
      validFrom: new Date().toISOString(),
      isActive: true,
    });
  };

  const handleRefreshAll = () => {
    refetchOverview();
    refetchRules();
    refetchJur();
    refetchCat();
    refetchExempt();
    refetchCalc();
    refetchCommerce();
  };

  // Filtered Rules
  const filteredRules = (rules ?? []).filter((r) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      r.jurisdictionName?.toLowerCase().includes(term) ||
      r.categoryName?.toLowerCase().includes(term) ||
      r.rate.includes(term) ||
      r.version.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Taxes & Compliance
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Jurisdiction-aware rates, product classifications, exemptions,
                and auditable calculation quotes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 font-medium">
            <Activity className="h-3 w-3 animate-pulse text-emerald-500" />
            <span>
              Tax Collected: $
              {(commerceAnalytics?.totalTaxCollected ?? 0).toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 },
              )}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="h-9 px-3 gap-1.5 text-xs text-slate-600 dark:text-slate-300"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>

          {/* ADD RULE SHEET */}
          <Sheet open={isRuleSheetOpen} onOpenChange={setIsRuleSheetOpen}>
            <SheetTrigger asChild>
              <Button
                size="sm"
                className="h-9 px-3.5 gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Tax Rule
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Create Tax Rule</SheetTitle>
                <SheetDescription>
                  Configure a tax rate for a specific jurisdiction and product
                  classification.
                </SheetDescription>
              </SheetHeader>
              <form
                onSubmit={handleCreateRule}
                className="flex flex-col gap-4 mt-6"
              >
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Jurisdiction
                  </label>
                  <select
                    value={ruleJurisdictionId}
                    onChange={(e) => setRuleJurisdictionId(e.target.value)}
                    required
                    className="w-full mt-1.5 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Jurisdiction...</option>
                    {(jurisdictions ?? []).map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name} ({j.jurisdictionCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Product Tax Category
                  </label>
                  <select
                    value={ruleCategoryId}
                    onChange={(e) => setRuleCategoryId(e.target.value)}
                    required
                    className="w-full mt-1.5 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Category...</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tax Rate (%)
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    max="100"
                    value={ruleRatePercent}
                    onChange={(e) => setRuleRatePercent(e.target.value)}
                    placeholder="e.g. 8.25"
                    required
                    className="mt-1.5"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    e.g. 8.25% will calculate as 0.0825 decimal multiplier.
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="ruleIsInclusive"
                    checked={ruleIsInclusive}
                    onChange={(e) => setRuleIsInclusive(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="ruleIsInclusive"
                    className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Tax Inclusive (VAT / GST included in shelf price)
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Priority (1 = Base, 2 = Surtax)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={rulePriority}
                      onChange={(e) => setRulePriority(Number(e.target.value))}
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Rule Version
                    </label>
                    <Input
                      type="text"
                      value={ruleVersion}
                      onChange={(e) => setRuleVersion(e.target.value)}
                      required
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={createRuleMutation.isPending}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  {createRuleMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Tax Rule
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border-slate-200/80 dark:border-slate-800">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Active Tax Rules</span>
              <Percent className="w-3.5 h-3.5 text-indigo-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {isOverviewLoading ? "..." : (overview?.activeRules ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Live calculation rates
            </span>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border-slate-200/80 dark:border-slate-800">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Jurisdictions</span>
              <Globe2 className="w-3.5 h-3.5 text-blue-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {isOverviewLoading ? "..." : (overview?.totalJurisdictions ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-slate-500 font-medium">
              Countries & regions
            </span>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border-slate-200/80 dark:border-slate-800">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Tax Categories</span>
              <Tag className="w-3.5 h-3.5 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {isOverviewLoading ? "..." : (overview?.totalCategories ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-slate-500 font-medium">
              Product classifications
            </span>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border-slate-200/80 dark:border-slate-800">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Audited Snapshots</span>
              <Receipt className="w-3.5 h-3.5 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {isOverviewLoading ? "..." : (overview?.totalCalculations ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-slate-500 font-medium">
              Permanent audit records
            </span>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border-slate-200/80 dark:border-slate-800 col-span-2 md:col-span-1">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Tax Engine</span>
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            </CardDescription>
            <div className="mt-1">
              <Badge className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-[11px] font-bold">
                {overview?.provider?.toUpperCase() ?? "STANDARD"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-slate-500 font-medium">
              Pluggable adapter active
            </span>
          </CardContent>
        </Card>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeTab === "rules"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          Tax Rules & Rates ({rules?.length ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("jurisdictions")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeTab === "jurisdictions"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Globe2 className="w-3.5 h-3.5" />
          Jurisdictions ({jurisdictions?.length ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeTab === "categories"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Product Categories ({categories?.length ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("exemptions")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeTab === "exemptions"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          Exemptions ({exemptions?.length ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("audits")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeTab === "audits"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Calculation Audit Log ({calculations?.length ?? 0})
        </button>
      </div>

      {/* TAB CONTENT: RULES */}
      {activeTab === "rules" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Search rules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/75 dark:bg-slate-900">
                  <TableHead className="text-xs font-bold">
                    Jurisdiction
                  </TableHead>
                  <TableHead className="text-xs font-bold">Category</TableHead>
                  <TableHead className="text-xs font-bold">Rate (%)</TableHead>
                  <TableHead className="text-xs font-bold">Tax Type</TableHead>
                  <TableHead className="text-xs font-bold">Priority</TableHead>
                  <TableHead className="text-xs font-bold">Version</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                  <TableHead className="text-xs font-bold text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRulesLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                    </TableCell>
                  </TableRow>
                ) : filteredRules.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-xs text-slate-500"
                    >
                      No tax rules found matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRules.map((rule) => {
                    const ratePercentage = (
                      parseFloat(rule.rate) * 100
                    ).toFixed(2);
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-semibold text-xs text-slate-900 dark:text-white">
                          {rule.jurisdictionName ?? rule.jurisdictionId}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {rule.categoryName ?? rule.categoryId}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {ratePercentage}%
                        </TableCell>
                        <TableCell className="text-xs">
                          {rule.isInclusive ? (
                            <Badge className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px]">
                              Inclusive (VAT)
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                              Exclusive (Sales Tax)
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-500">
                          Priority {rule.priority}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">
                          {rule.version}
                        </TableCell>
                        <TableCell className="text-xs">
                          {rule.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                              <AlertCircle className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {rule.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                deactivateRuleMutation.mutate(rule.id)
                              }
                              disabled={deactivateRuleMutation.isPending}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 h-7 text-xs font-semibold px-2"
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                activateRuleMutation.mutate(rule.id)
                              }
                              disabled={activateRuleMutation.isPending}
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 h-7 text-xs font-semibold px-2"
                            >
                              Activate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: JURISDICTIONS */}
      {activeTab === "jurisdictions" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Jurisdictions Directory ({jurisdictions?.length ?? 0})
            </h2>

            <Sheet
              open={isJurisdictionSheetOpen}
              onOpenChange={setIsJurisdictionSheetOpen}
            >
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold bg-indigo-600 text-white"
                >
                  <Plus className="w-3 h-3" />
                  Add Jurisdiction
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Add Tax Jurisdiction</SheetTitle>
                  <SheetDescription>
                    Define a national, regional, or municipal taxation boundary.
                  </SheetDescription>
                </SheetHeader>
                <form
                  onSubmit={handleCreateJurisdiction}
                  className="flex flex-col gap-4 mt-6"
                >
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Country Code (ISO 2-letter)
                    </label>
                    <Input
                      maxLength={2}
                      value={jurCountryCode}
                      onChange={(e) =>
                        setJurCountryCode(e.target.value.toUpperCase())
                      }
                      placeholder="US"
                      required
                      className="mt-1.5 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Region / State Code
                    </label>
                    <Input
                      value={jurRegionCode}
                      onChange={(e) =>
                        setJurRegionCode(e.target.value.toUpperCase())
                      }
                      placeholder="CA"
                      className="mt-1.5 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Municipality / City (Optional)
                    </label>
                    <Input
                      value={jurMunicipality}
                      onChange={(e) => setJurMunicipality(e.target.value)}
                      placeholder="Los Angeles"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Jurisdiction Code
                    </label>
                    <Input
                      value={jurCode}
                      onChange={(e) => setJurCode(e.target.value.toUpperCase())}
                      placeholder="US-CA"
                      required
                      className="mt-1.5 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Display Name
                    </label>
                    <Input
                      value={jurName}
                      onChange={(e) => setJurName(e.target.value)}
                      placeholder="California State"
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={createJurMutation.isPending}
                    className="mt-3 bg-indigo-600 text-white font-semibold"
                  >
                    Save Jurisdiction
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/75 dark:bg-slate-900">
                  <TableHead className="text-xs font-bold">Country</TableHead>
                  <TableHead className="text-xs font-bold">
                    Region/State
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    Municipality
                  </TableHead>
                  <TableHead className="text-xs font-bold">Code</TableHead>
                  <TableHead className="text-xs font-bold">Name</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isJurLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                    </TableCell>
                  </TableRow>
                ) : (
                  (jurisdictions ?? []).map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-bold text-xs">
                        {j.countryCode}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {j.regionCode ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {j.municipality ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                        {j.jurisdictionCode}
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        {j.name}
                      </TableCell>
                      <TableCell className="text-xs">
                        {j.isActive ? (
                          <span className="text-emerald-600 text-[11px] font-bold">
                            Active
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            Inactive
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CATEGORIES */}
      {activeTab === "categories" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Product Tax Categories ({categories?.length ?? 0})
            </h2>

            <Sheet
              open={isCategorySheetOpen}
              onOpenChange={setIsCategorySheetOpen}
            >
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold bg-indigo-600 text-white"
                >
                  <Plus className="w-3 h-3" />
                  Add Category
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Add Tax Category</SheetTitle>
                  <SheetDescription>
                    Define product classifications for differential tax rates
                    (e.g. food, clothing, digital goods).
                  </SheetDescription>
                </SheetHeader>
                <form
                  onSubmit={handleCreateCategory}
                  className="flex flex-col gap-4 mt-6"
                >
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Code (e.g. standard, digital, clothing)
                    </label>
                    <Input
                      value={catCode}
                      onChange={(e) => setCatCode(e.target.value.toLowerCase())}
                      placeholder="clothing"
                      required
                      className="mt-1.5 lowercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Name
                    </label>
                    <Input
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="Apparel & Clothing"
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Description
                    </label>
                    <Input
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      placeholder="Apparel and garments"
                      className="mt-1.5"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={createCatMutation.isPending}
                    className="mt-3 bg-indigo-600 text-white font-semibold"
                  >
                    Save Category
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/75 dark:bg-slate-900">
                  <TableHead className="text-xs font-bold">
                    Category Code
                  </TableHead>
                  <TableHead className="text-xs font-bold">Name</TableHead>
                  <TableHead className="text-xs font-bold">
                    Description
                  </TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isCatLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                    </TableCell>
                  </TableRow>
                ) : (
                  (categories ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {c.code}
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        {c.name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {c.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.isActive ? (
                          <span className="text-emerald-600 text-[11px] font-bold">
                            Active
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            Inactive
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EXEMPTIONS */}
      {activeTab === "exemptions" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Customer Tax Exemptions ({exemptions?.length ?? 0})
            </h2>

            <Sheet
              open={isExemptionSheetOpen}
              onOpenChange={setIsExemptionSheetOpen}
            >
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold bg-indigo-600 text-white"
                >
                  <Plus className="w-3 h-3" />
                  Add Exemption
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Add Tax Exemption</SheetTitle>
                  <SheetDescription>
                    Record a customer certificate or government tax exemption.
                  </SheetDescription>
                </SheetHeader>
                <form
                  onSubmit={handleCreateExemption}
                  className="flex flex-col gap-4 mt-6"
                >
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Customer ID (Optional)
                    </label>
                    <Input
                      value={exemptCustId}
                      onChange={(e) => setExemptCustId(e.target.value)}
                      placeholder="cust_12345"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Certificate Number
                    </label>
                    <Input
                      value={exemptCert}
                      onChange={(e) =>
                        setExemptCert(e.target.value.toUpperCase())
                      }
                      placeholder="CERT-RESALE-1001"
                      required
                      className="mt-1.5 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Exemption Type
                    </label>
                    <select
                      value={exemptType}
                      onChange={(e) =>
                        setExemptType(
                          e.target.value as
                            | "wholesale"
                            | "government"
                            | "diplomatic"
                            | "charity"
                            | "educational",
                        )
                      }
                      className="w-full mt-1.5 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      <option value="wholesale">Wholesale / Resale</option>
                      <option value="government">Government Agency</option>
                      <option value="charity">Non-Profit / Charity</option>
                      <option value="educational">
                        Educational Institution
                      </option>
                      <option value="diplomatic">Diplomatic</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    disabled={createExemptMutation.isPending}
                    className="mt-3 bg-indigo-600 text-white font-semibold"
                  >
                    Save Exemption
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/75 dark:bg-slate-900">
                  <TableHead className="text-xs font-bold">
                    Certificate
                  </TableHead>
                  <TableHead className="text-xs font-bold">Type</TableHead>
                  <TableHead className="text-xs font-bold">
                    Customer ID
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    Valid From
                  </TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isExemptLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                    </TableCell>
                  </TableRow>
                ) : (exemptions ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-xs text-slate-500"
                    >
                      No customer exemptions on record.
                    </TableCell>
                  </TableRow>
                ) : (
                  (exemptions ?? []).map((ex) => (
                    <TableRow key={ex.id}>
                      <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {ex.exemptionCertificate}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 text-[10px] capitalize">
                          {ex.exemptionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-500">
                        {ex.customerId ?? "Global Certificate"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {new Date(ex.validFrom).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ex.isActive ? (
                          <span className="text-emerald-600 text-[11px] font-bold">
                            Active
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            Expired
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: AUDITS */}
      {activeTab === "audits" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Permanent Tax Calculation Snapshots ({calculations?.length ?? 0})
            </h2>
            <p className="text-xs text-slate-500">
              Immutable calculation history stored in MySQL for fiscal audit
              compliance.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/75 dark:bg-slate-900">
                  <TableHead className="text-xs font-bold">
                    Calculation ID
                  </TableHead>
                  <TableHead className="text-xs font-bold">Reference</TableHead>
                  <TableHead className="text-xs font-bold">Type</TableHead>
                  <TableHead className="text-xs font-bold">Subtotal</TableHead>
                  <TableHead className="text-xs font-bold">Tax Total</TableHead>
                  <TableHead className="text-xs font-bold">
                    Grand Total
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    Rule Version
                  </TableHead>
                  <TableHead className="text-xs font-bold">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isCalcLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                    </TableCell>
                  </TableRow>
                ) : (calculations ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-xs text-slate-500"
                    >
                      No tax calculations recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (calculations ?? []).map((calc) => (
                    <TableRow key={calc.id}>
                      <TableCell className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {calc.id.slice(0, 12)}...
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-300">
                        {calc.referenceId ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-mono"
                        >
                          {calc.referenceType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        ${calc.subtotal}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ${calc.taxTotal}
                      </TableCell>
                      <TableCell className="text-xs font-bold">
                        ${calc.total}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-400">
                        {calc.ruleVersion}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {calc.createdAt
                          ? new Date(calc.createdAt).toLocaleString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
