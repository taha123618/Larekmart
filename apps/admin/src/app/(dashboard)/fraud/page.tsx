"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAdminFraudCases,
  fetchAdminFraudRules,
  reviewAdminFraudCase,
} from "@/services/fraud.service";
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
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Sliders,
  Eye,
  ShieldCheck,
  Ban,
  Activity,
  Layers,
} from "lucide-react";
import { toast } from "react-toastify";
import type {
  FraudCase,
  FraudCaseStatus,
  FraudCasePriority,
  AssessmentWorkflow,
  AnalystDecision,
} from "@repo/types";

export default function AdminFraudPage(): React.JSX.Element {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"CASES" | "RULES">("CASES");
  const [statusFilter, setStatusFilter] = useState<FraudCaseStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<FraudCasePriority | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCase, setSelectedCase] = useState<FraudCase | null>(null);

  // Review sheet state
  const [analystDecision, setAnalystDecision] = useState<AnalystDecision>("BLOCK");
  const [reviewNotes, setReviewNotes] = useState("");

  const casesQuery = useQuery({
    queryKey: ["admin-fraud-cases", statusFilter, priorityFilter],
    queryFn: async () => {
      const token = (await getToken()) || undefined;
      return fetchAdminFraudCases(
        {
          status: statusFilter,
          priority: priorityFilter,
          limit: 100,
        },
        token,
      );
    },
  });

  const rulesQuery = useQuery({
    queryKey: ["admin-fraud-rules"],
    queryFn: async () => {
      const token = (await getToken()) || undefined;
      return fetchAdminFraudRules(undefined, token);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      caseId,
      decision,
      notes,
    }: {
      caseId: string;
      decision: AnalystDecision;
      notes: string;
    }) => {
      const token = (await getToken()) || undefined;
      return reviewAdminFraudCase(
        caseId,
        {
          decision,
          notes,
          analystId: "admin-analyst",
        },
        token,
      );
    },
    onSuccess: (data) => {
      toast.success(`Case resolved: ${data.decision}`);
      setSelectedCase(null);
      setReviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-fraud-cases"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to review fraud case";
      toast.error(msg);
    },
  });

  const cases = casesQuery.data || [];
  const rules = rulesQuery.data || [];

  const filteredCases = cases.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.id.toLowerCase().includes(q) ||
      c.entityId.toLowerCase().includes(q) ||
      c.workflow.toLowerCase().includes(q)
    );
  });

  // KPI Calculations
  const activeCasesCount = cases.filter(
    (c) => c.status === "OPEN" || c.status === "IN_REVIEW",
  ).length;
  const criticalCasesCount = cases.filter((c) => c.priority === "CRITICAL").length;
  const blockedCasesCount = cases.filter((c) => c.status === "RESOLVED_BLOCKED").length;
  const activeRulesCount = rules.filter((r) => r.isActive).length;

  const renderStatusBadge = (status: FraudCaseStatus) => {
    switch (status) {
      case "OPEN":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            OPEN
          </Badge>
        );
      case "IN_REVIEW":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            IN REVIEW
          </Badge>
        );
      case "RESOLVED_BLOCKED":
        return (
          <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 flex items-center gap-1">
            <Ban className="w-3 h-3" />
            BLOCKED
          </Badge>
        );
      case "RESOLVED_DISMISSED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            DISMISSED
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderPriorityBadge = (priority: FraudCasePriority) => {
    switch (priority) {
      case "CRITICAL":
        return (
          <Badge className="bg-red-600 text-white font-bold flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            CRITICAL
          </Badge>
        );
      case "HIGH":
        return (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
            HIGH
          </Badge>
        );
      case "MEDIUM":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            MEDIUM
          </Badge>
        );
      case "LOW":
        return (
          <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">
            LOW
          </Badge>
        );
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const renderWorkflowBadge = (workflow: AssessmentWorkflow) => {
    return (
      <Badge variant="outline" className="font-mono text-xs">
        {workflow}
      </Badge>
    );
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-red-600" />
            Fraud & Risk Control Center
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time anomaly scoring, velocity abuse detection, multi-workflow risk assessment, and analyst case reviews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["admin-fraud-cases"] });
              queryClient.invalidateQueries({ queryKey: ["admin-fraud-rules"] });
            }}
            disabled={casesQuery.isFetching || rulesQuery.isFetching}
            className="flex items-center gap-1.5"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                casesQuery.isFetching || rulesQuery.isFetching ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCasesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting analyst review (OPEN / IN_REVIEW)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Priority</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCasesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Severe velocity spikes & extreme amounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Blocks</CardTitle>
            <Ban className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blockedCasesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Transactions & payouts halted by policy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scoring Rules</CardTitle>
            <Sliders className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRulesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active explainable risk criteria
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === "CASES" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("CASES")}
          className="flex items-center gap-1.5"
        >
          <Layers className="h-4 w-4" />
          Investigation Cases ({cases.length})
        </Button>
        <Button
          variant={activeTab === "RULES" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("RULES")}
          className="flex items-center gap-1.5"
        >
          <Sliders className="h-4 w-4" />
          Configured Rules ({rules.length})
        </Button>
      </div>

      {/* CASES TAB */}
      {activeTab === "CASES" && (
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Fraud Investigation Cases</CardTitle>
                <CardDescription>
                  Review flagged transactions, account takeovers, coupon abuse, and seller risk.
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search entity or case ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as FraudCaseStatus | "ALL")
                  }
                  aria-label="Filter cases by status"
                  className="h-9 text-xs rounded-md border border-input bg-background px-2.5 py-1 text-foreground"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="RESOLVED_BLOCKED">Resolved (Blocked)</option>
                  <option value="RESOLVED_DISMISSED">Resolved (Dismissed)</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) =>
                    setPriorityFilter(
                      e.target.value as FraudCasePriority | "ALL",
                    )
                  }
                  aria-label="Filter cases by priority"
                  className="h-9 text-xs rounded-md border border-input bg-background px-2.5 py-1 text-foreground"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {casesQuery.isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading fraud cases...
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No fraud cases found matching criteria.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case ID</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">
                          {c.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>{renderWorkflowBadge(c.workflow)}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[140px] truncate">
                          {c.entityId}
                        </TableCell>
                        <TableCell>{renderPriorityBadge(c.priority)}</TableCell>
                        <TableCell>{renderStatusBadge(c.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCase(c);
                              setAnalystDecision("BLOCK");
                              setReviewNotes("");
                            }}
                            className="flex items-center gap-1 ml-auto text-xs h-8"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Investigate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* RULES TAB */}
      {activeTab === "RULES" && (
        <Card>
          <CardHeader>
            <CardTitle>Configured Risk Scoring Rules</CardTitle>
            <CardDescription>
              Deterministic scoring criteria evaluating user velocity, transaction amounts, and behavioral anomalies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rulesQuery.isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading fraud rules...
              </div>
            ) : rules.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No scoring rules registered.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Score Delta</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Fail Mode</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {r.ruleCode}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{r.name}</div>
                          {r.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {r.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{renderWorkflowBadge(r.workflow)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-bold text-amber-600">
                            +{r.scoreDelta}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              r.action === "BLOCK"
                                ? "bg-red-500/10 text-red-600"
                                : r.action === "REVIEW"
                                  ? "bg-amber-500/10 text-amber-600"
                                  : "bg-blue-500/10 text-blue-600"
                            }
                          >
                            {r.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {r.failMode}
                          </span>
                        </TableCell>
                        <TableCell>
                          {r.isActive ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600">Active</Badge>
                          ) : (
                            <Badge variant="outline">Disabled</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Investigation & Review Sheet */}
      <Sheet open={!!selectedCase} onOpenChange={(open) => !open && setSelectedCase(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Case Investigation Review
            </SheetTitle>
            <SheetDescription>
              Evaluate evidence signals, determine policy compliance, and commit an immutable analyst decision.
            </SheetDescription>
          </SheetHeader>

          {selectedCase && (
            <div className="space-y-5 py-4">
              <div className="p-3 bg-muted rounded-md space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Case ID:</span>
                  <span className="font-mono">{selectedCase.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assessment ID:</span>
                  <span className="font-mono">{selectedCase.assessmentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entity ID:</span>
                  <span className="font-mono font-medium">{selectedCase.entityId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Workflow:</span>
                  <span>{renderWorkflowBadge(selectedCase.workflow)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Priority:</span>
                  <span>{renderPriorityBadge(selectedCase.priority)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status:</span>
                  <span>{renderStatusBadge(selectedCase.status)}</span>
                </div>
              </div>

              {/* Analyst Decision */}
              <div className="space-y-2">
                <label className="text-xs font-semibold">Analyst Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={analystDecision === "APPROVE" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAnalystDecision("APPROVE")}
                    className="flex items-center gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Approve (Allow)
                  </Button>
                  <Button
                    type="button"
                    variant={analystDecision === "BLOCK" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setAnalystDecision("BLOCK")}
                    className="flex items-center gap-1.5"
                  >
                    <Ban className="h-4 w-4" />
                    Block (Confirm)
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {analystDecision === "APPROVE"
                    ? "Marks the case as resolved/dismissed. Entity is cleared for execution."
                    : "Confirms fraudulent pattern. Haults entity execution and places security holds."}
                </p>
              </div>

              {/* Review Notes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold">Investigation Notes & Rationale</label>
                <Textarea
                  placeholder="Detail the verified evidence, phone verification result, or chargeback risk..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  className="text-xs"
                />
              </div>

              <div className="pt-2">
                <Button
                  className="w-full"
                  disabled={reviewMutation.isPending || !reviewNotes.trim()}
                  onClick={() => {
                    reviewMutation.mutate({
                      caseId: selectedCase.id,
                      decision: analystDecision,
                      notes: reviewNotes.trim(),
                    });
                  }}
                >
                  {reviewMutation.isPending ? "Submitting Resolution..." : "Commit Resolution"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

