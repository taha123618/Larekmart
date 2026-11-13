"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAdminFeatureFlags,
  saveAdminFeatureFlag,
  toggleAdminFeatureFlag,
  updateAdminFeatureFlagRollout,
  deleteAdminFeatureFlag,
  evaluateAdminFeatureFlag,
  type FeatureFlagDefinition,
  type EvaluationResult,
} from "@/services/feature-flags.service";
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
import { Textarea } from "@/components/ui/textarea";
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
  Sliders,
  CheckCircle2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Edit,
  Check,
  Zap,
  Target,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";

export default function FeatureFlagsDashboardPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create / Edit modal state
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingFlag, setEditingFlag] = useState<Partial<FeatureFlagDefinition> | null>(null);

  // Playground simulation state
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState<boolean>(false);
  const [playgroundFlagKey, setPlaygroundFlagKey] = useState<string>("");
  const [playgroundTargetingKey, setPlaygroundTargetingKey] = useState<string>("user_test_42");
  const [playgroundAttributes, setPlaygroundAttributes] = useState<string>(
    JSON.stringify({ tier: "platinum", role: "admin", country: "PK" }, null, 2),
  );
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Fetch flags
  const {
    data: flags = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["admin", "feature-flags"],
    queryFn: () => fetchAdminFeatureFlags(getToken),
    staleTime: 5000,
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      toggleAdminFeatureFlag(key, enabled, getToken),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
      toast.success(
        `Feature flag '${variables.key}' ${variables.enabled ? "enabled" : "disabled"}`,
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to toggle feature flag");
    },
  });

  // Rollout mutation
  const rolloutMutation = useMutation({
    mutationFn: ({ key, percentage }: { key: string; percentage: number }) =>
      updateAdminFeatureFlagRollout(key, percentage, getToken),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
      toast.success(
        `Canary rollout for '${variables.key}' set to ${variables.percentage}%`,
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update rollout");
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (flag: FeatureFlagDefinition) =>
      saveAdminFeatureFlag(flag, getToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
      setIsEditorOpen(false);
      setEditingFlag(null);
      toast.success("Feature flag saved successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to persist feature flag");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (key: string) => deleteAdminFeatureFlag(key, getToken),
    onSuccess: (_, key) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
      toast.success(`Feature flag '${key}' deleted`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete feature flag");
    },
  });

  // Evaluation simulation handler
  const handleSimulateEvaluation = async () => {
    if (!playgroundFlagKey) return;
    setIsEvaluating(true);
    setEvaluationResult(null);
    try {
      let parsedAttrs: Record<string, any> = {};
      try {
        parsedAttrs = JSON.parse(playgroundAttributes);
      } catch {
        toast.error("Invalid attributes JSON");
        setIsEvaluating(false);
        return;
      }

      const res = await evaluateAdminFeatureFlag(
        playgroundFlagKey,
        {
          targetingKey: playgroundTargetingKey,
          attributes: parsedAttrs,
        },
        false,
        getToken,
      );
      setEvaluationResult(res);
    } catch (err: any) {
      toast.error(err.message || "Evaluation failed");
    } finally {
      setIsEvaluating(false);
    }
  };

  // Filter flags
  const filteredFlags = flags.filter((f) => {
    const matchesSearch =
      f.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === "ACTIVE") return f.enabled;
    if (statusFilter === "INACTIVE") return !f.enabled;
    if (statusFilter === "CANARY") {
      const pct = f.rollout?.percentage ?? 0;
      return f.enabled && pct > 0 && pct < 100;
    }
    return true;
  });

  // KPI Metrics
  const totalFlags = flags.length;
  const activeFlags = flags.filter((f) => f.enabled).length;
  const canaryFlags = flags.filter(
    (f) => f.enabled && (f.rollout?.percentage ?? 0) > 0 && (f.rollout?.percentage ?? 0) < 100,
  ).length;
  const targetedRulesFlags = flags.filter(
    (f) => f.rules && f.rules.length > 0,
  ).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Feature Flags & Canary Rollouts</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              OpenFeature Runtime
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Centralized dynamic feature toggles, percentage-based traffic splits, and attribute targeting across Larekmart microservices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingFlag({
                key: "",
                enabled: true,
                defaultValue: false,
                description: "",
                rollout: { percentage: 0 },
              });
              setIsEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Feature Flag
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Flags</CardTitle>
            <Sliders className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFlags}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered in Redis state</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active (Enabled)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{activeFlags}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalFlags > 0 ? ((activeFlags / totalFlags) * 100).toFixed(0) : 0}% of total registry
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Canary Rollouts</CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{canaryFlags}</div>
            <p className="text-xs text-muted-foreground mt-1">Partial traffic splits (1-99%)</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Targeting Rules</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{targetedRulesFlags}</div>
            <p className="text-xs text-muted-foreground mt-1">Role & attribute conditioned</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter & Table Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Feature Flag Registry</CardTitle>
              <CardDescription>
                Sub-millisecond in-memory cached flags with real-time distributed Pub/Sub invalidation.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search flag key or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center rounded-lg border border-border p-1 bg-muted/40">
                {(["ALL", "ACTIVE", "CANARY", "INACTIVE"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      statusFilter === status
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Flag Key</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Canary Rollout</TableHead>
                  <TableHead className="font-semibold">Targeting Rules</TableHead>
                  <TableHead className="font-semibold">Default Value</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading feature flag registry...
                    </TableCell>
                  </TableRow>
                ) : filteredFlags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No feature flags match your search criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFlags.map((flag) => {
                    const rolloutPct = flag.rollout?.percentage ?? 0;
                    return (
                      <TableRow key={flag.key} className="hover:bg-muted/20">
                        {/* Key & Description */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-sm font-semibold">{flag.key}</span>
                            {flag.description && (
                              <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {flag.description}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Status & Quick Toggle */}
                        <TableCell>
                          <button
                            onClick={() =>
                              toggleMutation.mutate({
                                key: flag.key,
                                enabled: !flag.enabled,
                              })
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                              flag.enabled
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 hover:bg-zinc-500/20"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                flag.enabled ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"
                              }`}
                            />
                            {flag.enabled ? "Active" : "Disabled"}
                          </button>
                        </TableCell>

                        {/* Rollout slider & quick presets */}
                        <TableCell>
                          <div className="flex items-center gap-2 w-48">
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  rolloutPct === 100
                                    ? "bg-emerald-500"
                                    : rolloutPct > 0
                                      ? "bg-amber-500"
                                      : "bg-zinc-600"
                                }`}
                                style={{ width: `${rolloutPct}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs w-10 text-right">{rolloutPct}%</span>
                            <div className="flex gap-1">
                              {[0, 25, 50, 100].map((pct) => (
                                <button
                                  key={pct}
                                  onClick={() =>
                                    rolloutMutation.mutate({
                                      key: flag.key,
                                      percentage: pct,
                                    })
                                  }
                                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                    rolloutPct === pct
                                      ? "border-primary bg-primary text-primary-foreground font-bold"
                                      : "border-border/60 text-muted-foreground hover:bg-muted"
                                  }`}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </div>
                        </TableCell>

                        {/* Targeting rules */}
                        <TableCell>
                          {flag.rules && flag.rules.length > 0 ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                              {flag.rules.length} Rule{flag.rules.length > 1 ? "s" : ""}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Default</span>
                          )}
                        </TableCell>

                        {/* Default Value */}
                        <TableCell>
                          <span className="font-mono text-xs bg-muted/60 px-2 py-1 rounded">
                            {typeof flag.defaultValue === "object"
                              ? JSON.stringify(flag.defaultValue)
                              : String(flag.defaultValue)}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Test in Evaluation Playground"
                              onClick={() => {
                                setPlaygroundFlagKey(flag.key);
                                setEvaluationResult(null);
                                setIsPlaygroundOpen(true);
                              }}
                            >
                              <Play className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit Flag"
                              onClick={() => {
                                setEditingFlag(flag);
                                setIsEditorOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete Flag"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (
                                  confirm(`Are you sure you want to delete feature flag '${flag.key}'?`)
                                ) {
                                  deleteMutation.mutate(flag.key);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Editor Sheet (Create / Edit Flag) */}
      <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingFlag?.key ? `Edit Feature Flag: ${editingFlag.key}` : "Create New Feature Flag"}
            </SheetTitle>
            <SheetDescription>
              Define flag evaluation rules, canary distribution, and default values.
            </SheetDescription>
          </SheetHeader>

          {editingFlag && (
            <div className="space-y-4 py-4 text-sm">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Flag Key (Unique Identifier)
                </label>
                <Input
                  placeholder="e.g. checkout.instant_buy"
                  value={editingFlag.key || ""}
                  onChange={(e) =>
                    setEditingFlag((prev) => ({ ...prev, key: e.target.value }))
                  }
                  className="font-mono mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Description
                </label>
                <Input
                  placeholder="Purpose of this feature flag..."
                  value={editingFlag.description || ""}
                  onChange={(e) =>
                    setEditingFlag((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Initial State
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingFlag((prev) => ({
                          ...prev,
                          enabled: !prev?.enabled,
                        }))
                      }
                      className={`px-3 py-1 rounded text-xs font-medium border ${
                        editingFlag.enabled
                          ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {editingFlag.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Canary Rollout (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editingFlag.rollout?.percentage ?? 0}
                    onChange={(e) =>
                      setEditingFlag((prev) => ({
                        ...prev,
                        rollout: {
                          ...(prev?.rollout ?? {}),
                          percentage: Number(e.target.value),
                        },
                      }))
                    }
                    className="font-mono mt-1 w-28"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Default Value (JSON or Primitive)
                </label>
                <Textarea
                  rows={2}
                  value={
                    typeof editingFlag.defaultValue === "object"
                      ? JSON.stringify(editingFlag.defaultValue, null, 2)
                      : String(editingFlag.defaultValue ?? "false")
                  }
                  onChange={(e) => {
                    let val: any = e.target.value;
                    if (val === "true") val = true;
                    else if (val === "false") val = false;
                    else if (!isNaN(Number(val)) && val.trim() !== "") val = Number(val);
                    else {
                      try {
                        val = JSON.parse(val);
                      } catch {
                        // Keep raw string representation on parse failure
                      }
                    }
                    setEditingFlag((prev) => ({ ...prev, defaultValue: val }));
                  }}
                  className="font-mono text-xs mt-1"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!editingFlag.key) {
                      toast.error("Flag Key is required");
                      return;
                    }
                    saveMutation.mutate(editingFlag as FeatureFlagDefinition);
                  }}
                  disabled={saveMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save Flag
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Evaluation Playground Sheet */}
      <Sheet open={isPlaygroundOpen} onOpenChange={setIsPlaygroundOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <SheetTitle>Evaluation Playground</SheetTitle>
            </div>
            <SheetDescription>
              Test and verify how &apos;{playgroundFlagKey}&apos; resolves across deterministic targeting keys and user attributes.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4 text-sm">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Targeting Key (e.g. User ID or Session ID)
              </label>
              <Input
                value={playgroundTargetingKey}
                onChange={(e) => setPlaygroundTargetingKey(e.target.value)}
                placeholder="usr_12345"
                className="font-mono mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Evaluation Attributes (JSON)
              </label>
              <Textarea
                rows={5}
                value={playgroundAttributes}
                onChange={(e) => setPlaygroundAttributes(e.target.value)}
                className="font-mono text-xs mt-1"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSimulateEvaluation}
              disabled={isEvaluating}
            >
              <Play className="h-4 w-4 mr-2" />
              {isEvaluating ? "Evaluating..." : "Run Evaluation Simulation"}
            </Button>

            {evaluationResult && (
              <div className="mt-4 p-4 rounded-lg border border-border/80 bg-muted/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Evaluation Verdict</span>
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs ${
                      evaluationResult.reason === "PERCENTAGE_ROLLOUT"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : evaluationResult.reason === "TARGETING_MATCH"
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          : evaluationResult.reason === "DISABLED"
                            ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    }`}
                  >
                    Reason: {evaluationResult.reason}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Resolved Value</span>
                  <div className="font-mono text-lg font-bold bg-background p-2 rounded border border-border">
                    {typeof evaluationResult.value === "object"
                      ? JSON.stringify(evaluationResult.value)
                      : String(evaluationResult.value)}
                  </div>
                </div>

                {evaluationResult.variant && (
                  <div className="text-xs text-muted-foreground">
                    Allocated Variant:{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {evaluationResult.variant}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
