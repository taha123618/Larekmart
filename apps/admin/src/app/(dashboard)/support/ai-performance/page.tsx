"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAiSupportMetrics,
  sendAiSupportTestQuery,
  type AiSupportMetrics,
  type AiSupportInquiryRecord,
} from "@/services/support.service";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bot,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Zap,
  BarChart3,
  TrendingUp,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { toast } from "react-toastify";

export default function AiSupportPerformancePage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [testQuery, setTestQuery] = useState("");
  const [testResult, setTestResult] = useState<{
    answer: string;
    intent: string;
    confidence: number;
    sources: string[];
    suggestedAction?: string;
    canEscalate: boolean;
  } | null>(null);

  const [searchFilter, setSearchFilter] = useState("");

  const {
    data: metrics,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<AiSupportMetrics>({
    queryKey: ["admin-ai-support-metrics"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAiSupportMetrics(token);
    },
    refetchInterval: 30000,
  });

  const testQueryMutation = useMutation({
    mutationFn: async (message: string) => {
      const token = await getToken();
      return sendAiSupportTestQuery(message, token);
    },
    onSuccess: (data) => {
      setTestResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin-ai-support-metrics"] });
      toast.success("AI inference generated successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to process test query");
    },
  });

  const handleRunTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;
    testQueryMutation.mutate(testQuery.trim());
  };

  const handleQuickPrompt = (prompt: string) => {
    setTestQuery(prompt);
    testQueryMutation.mutate(prompt);
  };

  const filteredInquiries = (metrics?.recentInquiries || []).filter(
    (item: AiSupportInquiryRecord) => {
      if (!searchFilter.trim()) return true;
      const lower = searchFilter.toLowerCase();
      return (
        item.query.toLowerCase().includes(lower) ||
        item.intent.toLowerCase().includes(lower) ||
        (item.action && item.action.toLowerCase().includes(lower))
      );
    },
  );

  const totalInquiries = metrics?.totalInquiries || 0;
  const autoResolved = metrics?.autoResolved || 0;
  const escalated = metrics?.escalatedToTicket || 0;
  const deflectionRate = metrics?.autoResolutionRate ?? 0;
  const avgConfidence = metrics?.averageConfidence ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                AI Customer Support Performance
              </h1>
              <p className="text-sm text-muted-foreground">
                Automated inquiry deflection telemetry, knowledge base
                retrieval, and live test console.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
            />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Auto-Resolution Rate
            </CardTitle>
            <Zap className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {deflectionRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deflected without human intervention
            </p>
            <Progress value={deflectionRate} className="mt-3 h-1.5" />
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Inquiries
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInquiries}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cumulative buyer & seller AI queries
            </p>
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {autoResolved}
              </span>{" "}
              auto-resolved
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Escalated to Agent
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{escalated}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Low confidence / complex edge cases
            </p>
            <div className="mt-3 text-xs text-muted-foreground">
              {totalInquiries > 0
                ? `${Math.round((escalated / totalInquiries) * 100)}% escalation rate`
                : "0% escalation rate"}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mean Confidence Score
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">
              {(avgConfidence * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average semantic confidence score
            </p>
            <Progress value={avgConfidence * 100} className="mt-3 h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* Grid: Intent Breakdown & Live Test Console */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Intent Taxonomy Distribution */}
        <Card className="border shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                Intent Taxonomy Distribution
              </CardTitle>
            </div>
            <CardDescription>
              Volume and relative proportion across categorized support domains.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics?.intentBreakdown &&
              Object.entries(metrics.intentBreakdown).map(([intent, count]) => {
                const percentage =
                  totalInquiries > 0
                    ? Math.round((count / totalInquiries) * 100)
                    : 0;
                return (
                  <div key={intent} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium font-mono text-xs">
                        {intent}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {count} inquiries ({percentage}%)
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {/* Live Interactive Query Tester */}
        <Card className="border shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">
                Interactive AI Test Console
              </CardTitle>
            </div>
            <CardDescription>
              Test customer queries in real-time to inspect confidence scores
              and action recommendations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleRunTest} className="flex gap-2">
              <Input
                placeholder="Ask e.g. Where is my package #ORD-9821?"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                disabled={testQueryMutation.isPending}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={testQueryMutation.isPending || !testQuery.trim()}
                className="flex items-center gap-2"
              >
                {testQueryMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Inquire
              </Button>
            </form>

            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="text-muted-foreground self-center mr-1">
                Quick prompts:
              </span>
              <button
                type="button"
                onClick={() =>
                  handleQuickPrompt("Where is my order and how do I track it?")
                }
                className="rounded-md border bg-muted/50 px-2 py-1 text-xs hover:bg-muted"
              >
                Order Tracking
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickPrompt("Can I return a damaged shirt for refund?")
                }
                className="rounded-md border bg-muted/50 px-2 py-1 text-xs hover:bg-muted"
              >
                Return Policy
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickPrompt("How do I complete KYB seller onboarding?")
                }
                className="rounded-md border bg-muted/50 px-2 py-1 text-xs hover:bg-muted"
              >
                Merchant KYB
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickPrompt("My account has an unknown charge")
                }
                className="rounded-md border bg-muted/50 px-2 py-1 text-xs hover:bg-muted"
              >
                Unknown Query
              </button>
            </div>

            {testResult && (
              <div className="mt-4 rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {testResult.intent}
                    </Badge>
                    <Badge
                      className={
                        testResult.confidence >= 0.8
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : testResult.confidence >= 0.6
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                      }
                    >
                      {(testResult.confidence * 100).toFixed(0)}% Confidence
                    </Badge>
                  </div>
                  {testResult.suggestedAction && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      Action: {testResult.suggestedAction}
                    </Badge>
                  )}
                </div>

                <div className="text-sm font-medium leading-relaxed bg-background/80 rounded-md p-3 border">
                  {testResult.answer}
                </div>

                {testResult.sources && testResult.sources.length > 0 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="font-medium">Knowledge sources:</span>
                    <span>{testResult.sources.join(" • ")}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Inquiries Audit Trail */}
      <Card className="border shadow-xs">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">
              Recent Inquiries & Deflection Log
            </CardTitle>
            <CardDescription>
              Chronological log of customer queries, detected intents,
              confidence ratings, and routing decisions.
            </CardDescription>
          </div>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Filter by query or intent..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Timestamp</TableHead>
                  <TableHead>Customer Query</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead className="text-center">Confidence</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Deflection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredInquiries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground text-sm"
                    >
                      No inquiries match your filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInquiries.map((inquiry: AiSupportInquiryRecord) => (
                    <TableRow key={inquiry.id}>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {new Date(inquiry.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[280px] truncate">
                        {inquiry.query}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {inquiry.intent}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-semibold text-xs ${
                            inquiry.confidence >= 0.8
                              ? "text-emerald-600"
                              : inquiry.confidence >= 0.6
                                ? "text-amber-600"
                                : "text-rose-600"
                          }`}
                        >
                          {(inquiry.confidence * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {inquiry.action ? (
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {inquiry.action}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {inquiry.autoResolved ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Auto-Resolved
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Escalated
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
