"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchCanaryRuns,
  fetchCanarySla,
  triggerCanaryProbe,
} from "@/services/canary.service";
import type {
  CanaryProbeRun,
  CanaryScenarioType,
  CanaryStepResult,
} from "@repo/monitoring";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Activity,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  ShoppingCart,
  Eye,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "react-toastify";

export default function SystemHealthPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [selectedScenarioFilter, setSelectedScenarioFilter] = useState<
    "all" | CanaryScenarioType
  >("all");
  const [selectedRun, setSelectedRun] = useState<CanaryProbeRun | null>(null);

  // 1. Fetch SLA stats
  const {
    data: slaData,
    isLoading: isLoadingSla,
    refetch: refetchSla,
  } = useQuery({
    queryKey: ["admin", "canary", "sla"],
    queryFn: async () => {
      const token = await getToken();
      return fetchCanarySla(token);
    },
    refetchInterval: 30_000,
  });

  // 2. Fetch probe runs
  const {
    data: runsData,
    isLoading: isLoadingRuns,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: ["admin", "canary", "runs", selectedScenarioFilter],
    queryFn: async () => {
      const token = await getToken();
      return fetchCanaryRuns(token, {
        scenario:
          selectedScenarioFilter === "all" ? undefined : selectedScenarioFilter,
        limit: 50,
      });
    },
    refetchInterval: 15_000,
  });

  // 3. Trigger mutation
  const triggerMutation = useMutation({
    mutationFn: async (scenario: CanaryScenarioType) => {
      const token = await getToken();
      return triggerCanaryProbe(token, scenario);
    },
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "canary"] });
      if (run.success) {
        toast.success(
          `Synthetic ${run.scenario} probe completed successfully in ${run.totalDurationMs}ms`,
        );
      } else {
        toast.warn(
          `Synthetic ${run.scenario} probe reported failure: ${run.error || "Degraded step"}`,
        );
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Probe trigger failed: ${msg}`);
    },
  });

  const handleRefresh = () => {
    refetchSla();
    refetchRuns();
    toast.info("Refreshed canary telemetry data");
  };

  const runs = runsData || [];
  const latestRun = runs[0] || null;

  const readSla = slaData?.read;
  const checkoutSla = slaData?.checkout;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              System Health & Canaries
            </h1>
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Automated Probers Active
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Proactive continuous synthetic journeys verifying storefront reads,
            search indexes, and atomic checkout safety.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoadingSla || isLoadingRuns}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${isLoadingRuns ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={triggerMutation.isPending}
            onClick={() => triggerMutation.mutate("read")}
          >
            <Play className="h-4 w-4 mr-1.5 text-blue-500" />
            Run Read Probe
          </Button>
          <Button
            size="sm"
            disabled={triggerMutation.isPending}
            onClick={() => triggerMutation.mutate("checkout")}
          >
            <Play className="h-4 w-4 mr-1.5 text-emerald-400" />
            Run Checkout Probe
          </Button>
        </div>
      </div>

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Read SLA */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Read Journey SLA</span>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold flex items-baseline gap-2">
              {readSla ? `${readSla.slaPercentage.toFixed(1)}%` : "—"}
              <span className="text-xs font-normal text-muted-foreground">
                rolling SLA
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                {readSla
                  ? `${readSla.successfulRuns}/${readSla.totalRuns} passed`
                  : "Loading..."}
              </span>
              <Badge
                variant={
                  !readSla || readSla.slaPercentage >= 99
                    ? "default"
                    : readSla.slaPercentage >= 95
                      ? "secondary"
                      : "destructive"
                }
              >
                {!readSla || readSla.slaPercentage >= 99
                  ? "Healthy"
                  : "Degraded"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Checkout SLA */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Checkout Journey SLA</span>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold flex items-baseline gap-2">
              {checkoutSla ? `${checkoutSla.slaPercentage.toFixed(1)}%` : "—"}
              <span className="text-xs font-normal text-muted-foreground">
                rolling SLA
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                {checkoutSla
                  ? `${checkoutSla.successfulRuns}/${checkoutSla.totalRuns} passed`
                  : "Loading..."}
              </span>
              <Badge
                variant={
                  !checkoutSla || checkoutSla.slaPercentage >= 99
                    ? "default"
                    : checkoutSla.slaPercentage >= 95
                      ? "secondary"
                      : "destructive"
                }
              >
                {!checkoutSla || checkoutSla.slaPercentage >= 99
                  ? "Healthy"
                  : "Degraded"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Consecutive Failures */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Consecutive Failures</span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {checkoutSla?.consecutiveFailures ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Alert threshold: ≥ 2</span>
              {(checkoutSla?.consecutiveFailures ?? 0) >= 2 ? (
                <Badge variant="destructive">P1 Alert Fired</Badge>
              ) : (
                <Badge variant="outline" className="text-emerald-600">
                  Normal
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Isolation & Protection */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Synthetic Safety Guard</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              Zero-Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Side-effects dropped at email, payout, and fraud consumers.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Probe Waterfall Breakdown */}
      {latestRun && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Latest Probe Execution: {latestRun.scenario.toUpperCase()} (
                  {latestRun.runId})
                </CardTitle>
                <CardDescription>
                  Executed{" "}
                  {new Date(latestRun.completedAt).toLocaleTimeString()} • Total
                  duration: {latestRun.totalDurationMs}ms
                </CardDescription>
              </div>
              <Badge variant={latestRun.success ? "default" : "destructive"}>
                {latestRun.success ? "Passed" : "Failed"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {latestRun.steps.map((step: CanaryStepResult, idx: number) => {
                const maxDuration = Math.max(
                  ...latestRun.steps.map((s: CanaryStepResult) => s.durationMs),
                  1,
                );
                const widthPercent = Math.max(
                  5,
                  (step.durationMs / maxDuration) * 100,
                );

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-[240px]">
                      {step.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                      )}
                      <div>
                        <div className="font-medium">{step.step}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>HTTP {step.httpStatus ?? "ERR"}</span>
                          {step.error && (
                            <span className="text-rose-500 font-mono">
                              ({step.error})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Latency Bar */}
                    <div className="flex-1 max-w-md flex items-center gap-3">
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            step.success ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold text-muted-foreground w-16 text-right shrink-0">
                        {step.durationMs}ms
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Probe Runs Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Recent Synthetic Runs</CardTitle>
              <CardDescription>
                Historical rolling buffer of synthetic health probe outcomes
                (last 50 runs).
              </CardDescription>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant={
                  selectedScenarioFilter === "all" ? "default" : "outline"
                }
                size="sm"
                onClick={() => setSelectedScenarioFilter("all")}
              >
                All
              </Button>
              <Button
                variant={
                  selectedScenarioFilter === "read" ? "default" : "outline"
                }
                size="sm"
                onClick={() => setSelectedScenarioFilter("read")}
              >
                Read
              </Button>
              <Button
                variant={
                  selectedScenarioFilter === "checkout" ? "default" : "outline"
                }
                size="sm"
                onClick={() => setSelectedScenarioFilter("checkout")}
              >
                Checkout
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Scenario</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Steps Passed</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {isLoadingRuns
                      ? "Loading canary runs..."
                      : "No synthetic probe runs recorded yet."}
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run: CanaryProbeRun) => {
                  const passedSteps = run.steps.filter(
                    (s: CanaryStepResult) => s.success,
                  ).length;
                  return (
                    <TableRow key={run.runId}>
                      <TableCell className="font-mono text-xs font-medium">
                        {run.runId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {run.scenario}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {run.success ? (
                          <Badge
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {run.totalDurationMs}ms
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {passedSteps} / {run.steps.length}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(run.completedAt).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRun(run)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Details Sheet Modal */}
      <Sheet
        open={!!selectedRun}
        onOpenChange={(open) => !open && setSelectedRun(null)}
      >
        <SheetContent className="sm:max-w-md md:max-w-xl overflow-y-auto">
          {selectedRun && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Probe Run Details
                </SheetTitle>
                <SheetDescription>
                  Inspect individual HTTP steps, status codes, and error traces.
                </SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/40 p-4 rounded-lg">
                <div>
                  <span className="text-muted-foreground text-xs block">
                    Run ID
                  </span>
                  <span className="font-mono text-xs font-semibold">
                    {selectedRun.runId}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block">
                    Scenario
                  </span>
                  <span className="font-semibold capitalize">
                    {selectedRun.scenario}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block">
                    Result
                  </span>
                  <Badge
                    variant={selectedRun.success ? "default" : "destructive"}
                  >
                    {selectedRun.success ? "PASSED" : "FAILED"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block">
                    Duration
                  </span>
                  <span className="font-mono text-xs font-semibold">
                    {selectedRun.totalDurationMs}ms
                  </span>
                </div>
              </div>

              {selectedRun.error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg text-sm">
                  <div className="font-semibold">Root Failure Cause:</div>
                  <div className="font-mono text-xs mt-1">
                    {selectedRun.error}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Executed Steps Waterfall
                </h4>
                <div className="space-y-2">
                  {selectedRun.steps.map(
                    (step: CanaryStepResult, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 border rounded-lg bg-card space-y-1 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-medium">
                            {step.success ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-rose-500" />
                            )}
                            <span>
                              {idx + 1}. {step.step}
                            </span>
                          </div>
                          <Badge
                            variant={step.success ? "outline" : "destructive"}
                          >
                            {step.durationMs}ms
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex justify-between">
                          <span>HTTP {step.httpStatus ?? "N/A"}</span>
                          {step.error && (
                            <span className="text-rose-500 font-mono">
                              {step.error}
                            </span>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
