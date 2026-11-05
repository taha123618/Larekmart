"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAdminTickets,
  fetchTicketById,
  assignTicket,
  escalateTicket,
  postTicketMessage,
  updateTicketStatus,
  fetchSupportAnalytics,
  fetchSlaPolicies,
  fetchSupportCategories,
} from "@/services/support.service";
import type { TicketStatus, TicketPriority, SupportTeam } from "@repo/types";
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
  LifeBuoy,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Eye,
  Send,
  Lock,
  MessageSquare,
  ShieldAlert,
  Users,
  Check,
} from "lucide-react";

export default function SupportOperationsPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    "TICKETS" | "QUEUES" | "SLA_POLICIES" | "ANALYTICS"
  >("TICKETS");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Drawer / Workspace state
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [assignedTeam, setAssignedTeam] = useState<SupportTeam>("TIER_1");
  const [escalationReason, setEscalationReason] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Analytics & Overview Query
  const {
    data: analytics,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ["admin-support-analytics"],
    queryFn: async () => {
      const token = await getToken();
      return fetchSupportAnalytics(token);
    },
    refetchInterval: 15000,
  });

  // 2. Tickets List Query
  const {
    data: ticketsData,
    isLoading: ticketsLoading,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: [
      "admin-support-tickets",
      statusFilter,
      priorityFilter,
      categoryFilter,
      searchQuery,
    ],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminTickets(
        {
          status:
            statusFilter !== "ALL" ? (statusFilter as TicketStatus) : undefined,
          priority:
            priorityFilter !== "ALL"
              ? (priorityFilter as TicketPriority)
              : undefined,
          categoryCode: categoryFilter !== "ALL" ? categoryFilter : undefined,
          search: searchQuery.trim() || undefined,
          limit: 50,
        },
        token,
      );
    },
    refetchInterval: 10000,
  });

  // 3. Selected Ticket Details Query
  const { data: ticketDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-support-ticket-detail", selectedTicketId],
    queryFn: async () => {
      if (!selectedTicketId) return null;
      const token = await getToken();
      return fetchTicketById(selectedTicketId, token);
    },
    enabled: Boolean(selectedTicketId),
  });

  // 4. SLA Policies Query
  const { data: slaPolicies } = useQuery({
    queryKey: ["admin-support-sla-policies"],
    queryFn: async () => {
      const token = await getToken();
      return fetchSlaPolicies(token);
    },
  });

  // 5. Categories Query
  const { data: categories } = useQuery({
    queryKey: ["admin-support-categories"],
    queryFn: async () => {
      const token = await getToken();
      return fetchSupportCategories(token);
    },
  });

  // Mutations
  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicketId || !replyContent.trim()) return;
      const token = await getToken();
      return postTicketMessage(
        selectedTicketId,
        {
          content: replyContent.trim(),
          isInternalNote,
          attachments: [],
        },
        token,
      );
    },
    onSuccess: () => {
      setReplyContent("");
      setIsInternalNote(false);
      setActionError(null);
      queryClient.invalidateQueries({
        queryKey: ["admin-support-ticket-detail", selectedTicketId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to post message";
      setActionError(msg);
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicketId || !assigneeId.trim()) return;
      const token = await getToken();
      return assignTicket(
        selectedTicketId,
        {
          assignedTo: assigneeId.trim(),
          assignedTeam,
        },
        token,
      );
    },
    onSuccess: () => {
      setIsAssigning(false);
      setAssigneeId("");
      setActionError(null);
      queryClient.invalidateQueries({
        queryKey: ["admin-support-ticket-detail", selectedTicketId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-analytics"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to assign ticket";
      setActionError(msg);
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicketId || !escalationReason.trim()) return;
      const token = await getToken();
      return escalateTicket(
        selectedTicketId,
        {
          escalationReason: escalationReason.trim(),
          targetTeam: "ESCALATIONS",
          priority: "CRITICAL",
        },
        token,
      );
    },
    onSuccess: () => {
      setIsEscalating(false);
      setEscalationReason("");
      setActionError(null);
      queryClient.invalidateQueries({
        queryKey: ["admin-support-ticket-detail", selectedTicketId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-analytics"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to escalate ticket";
      setActionError(msg);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicketId) return;
      const token = await getToken();
      return updateTicketStatus(selectedTicketId, "RESOLVED", token);
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({
        queryKey: ["admin-support-ticket-detail", selectedTicketId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-analytics"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to resolve ticket";
      setActionError(msg);
    },
  });

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
      case "URGENT":
        return "destructive";
      case "HIGH":
        return "default";
      case "MEDIUM":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "OPEN":
        return "outline";
      case "IN_PROGRESS":
        return "default";
      case "WAITING_ON_CUSTOMER":
        return "secondary";
      case "ESCALATED":
        return "destructive";
      case "RESOLVED":
      case "CLOSED":
        return "default";
      default:
        return "outline";
    }
  };

  const tickets = ticketsData?.items || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Customer Support & SLA Operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Omnichannel ticket queues, SLA compliance monitoring, multi-tier
            escalations, and resolution analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchAnalytics();
              refetchTickets();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Support Tickets
            </CardTitle>
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? "..." : (analytics?.totalTickets ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active Open: {analytics?.statusBreakdown?.["OPEN"] ?? 0} | In
              Progress: {analytics?.statusBreakdown?.["IN_PROGRESS"] ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              SLA Breach Rate
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading
                ? "..."
                : `${analytics?.slaMetrics?.slaBreachRatePercentage ?? 0}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics?.slaMetrics?.breachedCount ?? 0} of{" "}
              {analytics?.slaMetrics?.totalResolved ?? 0} resolved tickets
              breached
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Resolution Time
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading
                ? "..."
                : `${analytics?.slaMetrics?.avgResolutionTimeMinutes ?? 0}m`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              First response:{" "}
              {analytics?.slaMetrics?.avgFirstResponseTimeMinutes ?? 0}m average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Agent Workload
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading
                ? "..."
                : (analytics?.agentWorkload?.length ?? 0)}{" "}
              Agents
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across Tier 1, Seller Ops & Escalations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b space-x-4">
        <button
          type="button"
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === "TICKETS"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("TICKETS")}
        >
          Tickets Queue ({tickets.length})
        </button>
        <button
          type="button"
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === "QUEUES"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("QUEUES")}
        >
          Agent Queues & Workloads
        </button>
        <button
          type="button"
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === "SLA_POLICIES"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("SLA_POLICIES")}
        >
          SLA Policies & Governance
        </button>
        <button
          type="button"
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === "ANALYTICS"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("ANALYTICS")}
        >
          Resolution Analytics
        </button>
      </div>

      {/* Tab 1: Tickets Queue */}
      {activeTab === "TICKETS" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Omnichannel Ticket Queue</CardTitle>
                <CardDescription>
                  Customer, seller, and administrator support cases requiring
                  assignment or response.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search ticket #, subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-[200px] pl-8 text-sm"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="WAITING_ON_CUSTOMER">
                    WAITING ON CUSTOMER
                  </option>
                  <option value="WAITING_ON_AGENT">WAITING ON AGENT</option>
                  <option value="ESCALATED">ESCALATED</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="URGENT">URGENT</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="ALL">All Categories</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ticketsLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading support tickets...
              </div>
            ) : tickets.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No tickets matching current filters.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer / Seller</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((t) => (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedTicketId(t.id)}
                      >
                        <TableCell className="font-mono text-xs font-semibold">
                          {t.ticketNumber}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate font-medium">
                          {t.subject}
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.category?.name || "General"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityBadgeVariant(t.priority)}>
                            {t.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(t.status)}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.customerEmail ||
                            t.customerId ||
                            t.sellerId ||
                            "Guest"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.assignedAgentId ? (
                            <span className="font-mono">
                              {t.assignedAgentId} ({t.assignedTeam || "TIER_1"})
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground">
                              Unassigned
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTicketId(t.id);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Manage
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

      {/* Tab 2: Agent Queues & Workloads */}
      {activeTab === "QUEUES" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Specialized Support Queues</CardTitle>
              <CardDescription>
                Live ticket counts by operational team queue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    team: "TIER_1",
                    label: "Tier 1 Frontline Support",
                    desc: "General customer inquiries, tracking and returns",
                  },
                  {
                    team: "TIER_2",
                    label: "Tier 2 Technical Support",
                    desc: "App defects, payment errors and account security",
                  },
                  {
                    team: "BILLING",
                    label: "Billing & Finance",
                    desc: "Double charges, invoice questions and refunds",
                  },
                  {
                    team: "SELLER_OPS",
                    label: "Seller Operations",
                    desc: "Marketplace seller payouts, commissions and store issues",
                  },
                  {
                    team: "ESCALATIONS",
                    label: "Executive Escalations",
                    desc: "High-value disputes, legal notices and critical issues",
                  },
                  {
                    team: "LOGISTICS",
                    label: "Logistics & Couriers",
                    desc: "Damaged freight, lost parcels and carrier coordination",
                  },
                ].map((item) => {
                  const count = analytics?.teamBreakdown?.[item.team] ?? 0;
                  return (
                    <Card key={item.team} className="border border-muted">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">
                          {item.label}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {item.desc}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {count} Tickets
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Agent Workload Distribution</CardTitle>
              <CardDescription>
                Number of open or in-progress tickets currently assigned per
                agent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.agentWorkload?.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No active assignments currently recorded.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent ID</TableHead>
                        <TableHead>Active Assigned Tickets</TableHead>
                        <TableHead>Capacity Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics?.agentWorkload?.map((w) => (
                        <TableRow key={w.agentId}>
                          <TableCell className="font-mono text-sm font-medium">
                            {w.agentId}
                          </TableCell>
                          <TableCell className="font-bold text-sm">
                            {w.activeTickets}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                w.activeTickets > 5
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {w.activeTickets > 5 ? "HIGH LOAD" : "OPTIMAL"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: SLA Policies */}
      {activeTab === "SLA_POLICIES" && (
        <Card>
          <CardHeader>
            <CardTitle>Service-Level Agreements (SLAs)</CardTitle>
            <CardDescription>
              Guaranteed target response times and escalation thresholds
              configured by priority tier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy Name</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>First Response Target</TableHead>
                    <TableHead>Resolution Target</TableHead>
                    <TableHead>Escalation Tier</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slaPolicies?.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold text-sm">
                        {p.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPriorityBadgeVariant(p.priority)}>
                          {p.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {p.firstResponseTimeMinutes} Minutes
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {p.resolutionTimeMinutes} Minutes (
                        {Math.round(p.resolutionTimeMinutes / 60)} hrs)
                      </TableCell>
                      <TableCell className="text-sm">
                        Tier {p.escalationTier}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-emerald-600 border-emerald-500"
                        >
                          Active
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Resolution Analytics */}
      {activeTab === "ANALYTICS" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Status Distribution</CardTitle>
              <CardDescription>
                Current volume by lifecycle state.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics?.statusBreakdown &&
                  Object.entries(analytics.statusBreakdown).map(
                    ([status, count]) => (
                      <div
                        key={status}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm font-medium">{status}</span>
                        <Badge variant={getStatusBadgeVariant(status)}>
                          {count}
                        </Badge>
                      </div>
                    ),
                  )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ticket Priority Distribution</CardTitle>
              <CardDescription>
                Current volume by urgency level.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics?.priorityBreakdown &&
                  Object.entries(analytics.priorityBreakdown).map(
                    ([prio, count]) => (
                      <div
                        key={prio}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm font-medium">{prio}</span>
                        <Badge variant={getPriorityBadgeVariant(prio)}>
                          {count}
                        </Badge>
                      </div>
                    ),
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Interactive Ticket Detail Workspace Drawer */}
      <Sheet
        open={Boolean(selectedTicketId)}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
      >
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
          {detailLoading || !ticketDetail ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading ticket workspace...
            </div>
          ) : (
            <div className="space-y-6">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {ticketDetail.ticketNumber}
                  </Badge>
                  <Badge
                    variant={getPriorityBadgeVariant(ticketDetail.priority)}
                  >
                    {ticketDetail.priority}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(ticketDetail.status)}>
                    {ticketDetail.status}
                  </Badge>
                </div>
                <SheetTitle className="text-lg font-bold">
                  {ticketDetail.subject}
                </SheetTitle>
                <SheetDescription>
                  Category: {ticketDetail.category?.name || "Support"} | Opened
                  on {new Date(ticketDetail.createdAt).toLocaleString()}
                </SheetDescription>
              </SheetHeader>

              {actionError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                  {actionError}
                </div>
              )}

              {/* SLA Deadlines Banner */}
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    First Response Due:
                  </span>
                  <span className="font-mono">
                    {ticketDetail.firstResponseDueAt
                      ? new Date(
                          ticketDetail.firstResponseDueAt,
                        ).toLocaleTimeString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolution Due:</span>
                  <span className="font-mono font-semibold">
                    {ticketDetail.resolutionDueAt
                      ? new Date(ticketDetail.resolutionDueAt).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
                {ticketDetail.firstResponseAt && (
                  <div className="flex justify-between text-emerald-600">
                    <span>First Response Completed:</span>
                    <span>
                      {new Date(
                        ticketDetail.firstResponseAt,
                      ).toLocaleTimeString()}
                    </span>
                  </div>
                )}
                {ticketDetail.isEscalated && (
                  <div className="flex items-center gap-1.5 text-amber-600 font-medium pt-1 border-t">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>
                      Escalated:{" "}
                      {ticketDetail.escalationReason || "Manager Review"}
                    </span>
                  </div>
                )}
              </div>

              {/* Related Entities Links */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {ticketDetail.orderId && (
                  <div className="p-2 border rounded">
                    <span className="text-muted-foreground block">
                      Order Reference:
                    </span>
                    <span className="font-mono font-medium">
                      {ticketDetail.orderId}
                    </span>
                  </div>
                )}
                {ticketDetail.sellerId && (
                  <div className="p-2 border rounded">
                    <span className="text-muted-foreground block">
                      Marketplace Seller:
                    </span>
                    <span className="font-mono font-medium">
                      {ticketDetail.sellerId}
                    </span>
                  </div>
                )}
                {ticketDetail.returnId && (
                  <div className="p-2 border rounded">
                    <span className="text-muted-foreground block">
                      Return Reference:
                    </span>
                    <span className="font-mono font-medium">
                      {ticketDetail.returnId}
                    </span>
                  </div>
                )}
                {ticketDetail.assignedAgentId && (
                  <div className="p-2 border rounded">
                    <span className="text-muted-foreground block">
                      Assigned Agent:
                    </span>
                    <span className="font-mono font-medium">
                      {ticketDetail.assignedAgentId} (
                      {ticketDetail.assignedTeam})
                    </span>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap gap-2 border-y py-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAssigning(!isAssigning)}
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Assign
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEscalating(!isEscalating)}
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                  Escalate
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/chat?ticketId=${ticketDetail.id}`}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Live Chat
                  </Link>
                </Button>
                {ticketDetail.status !== "RESOLVED" &&
                  ticketDetail.status !== "CLOSED" && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => resolveMutation.mutate()}
                      disabled={resolveMutation.isPending}
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Mark Resolved
                    </Button>
                  )}
              </div>

              {/* Assignment Form Popup */}
              {isAssigning && (
                <div className="p-3 border rounded-lg bg-muted/40 space-y-3 text-xs">
                  <div className="font-semibold text-sm">Assign Ticket</div>
                  <div>
                    <label className="text-muted-foreground block mb-1">
                      Agent ID
                    </label>
                    <Input
                      placeholder="e.g. agent_sarah_01"
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">
                      Support Team
                    </label>
                    <select
                      value={assignedTeam}
                      onChange={(e) =>
                        setAssignedTeam(e.target.value as SupportTeam)
                      }
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                    >
                      <option value="TIER_1">TIER 1 (Frontline)</option>
                      <option value="TIER_2">TIER 2 (Technical)</option>
                      <option value="BILLING">BILLING & FINANCE</option>
                      <option value="SELLER_OPS">SELLER OPERATIONS</option>
                      <option value="ESCALATIONS">EXECUTIVE ESCALATIONS</option>
                      <option value="LOGISTICS">LOGISTICS & COURIERS</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsAssigning(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => assignMutation.mutate()}
                      disabled={assignMutation.isPending || !assigneeId.trim()}
                    >
                      Confirm Assignment
                    </Button>
                  </div>
                </div>
              )}

              {/* Escalation Form Popup */}
              {isEscalating && (
                <div className="p-3 border rounded-lg bg-amber-500/10 border-amber-500/20 space-y-3 text-xs">
                  <div className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                    Escalate Support Ticket
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">
                      Escalation Reason
                    </label>
                    <Textarea
                      placeholder="Provide technical or business reason for escalation..."
                      value={escalationReason}
                      onChange={(e) => setEscalationReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEscalating(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => escalateMutation.mutate()}
                      disabled={
                        escalateMutation.isPending || !escalationReason.trim()
                      }
                    >
                      Confirm Escalation
                    </Button>
                  </div>
                </div>
              )}

              {/* Conversation Messages Timeline */}
              <div className="space-y-3">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Conversation & Internal Notes
                </div>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {ticketDetail.messages?.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-lg text-xs space-y-1.5 ${
                        m.isInternalNote
                          ? "bg-amber-500/10 border border-amber-500/30"
                          : m.senderRole === "ADMIN" || m.senderRole === "AGENT"
                            ? "bg-primary/5 border border-primary/20 ml-4"
                            : "bg-muted/50 border mr-4"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {m.isInternalNote && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-500/20 text-amber-700 border-amber-500/40"
                            >
                              <Lock className="h-2.5 w-2.5 mr-0.5 inline" />
                              Internal Staff Note
                            </Badge>
                          )}
                          <span className="font-semibold">
                            {m.senderName || m.senderId}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            ({m.senderRole})
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-foreground/90">
                        {m.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message / Internal Note Composer */}
              <div className="space-y-2 pt-2 border-t">
                <Textarea
                  placeholder={
                    isInternalNote
                      ? "Write private internal note (visible only to staff & admins)..."
                      : "Type reply to customer..."
                  }
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={3}
                  className="text-xs"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border"
                    />
                    <Lock className="h-3 w-3 text-amber-600" />
                    <span>Private Internal Note (Staff only)</span>
                  </label>
                  <Button
                    size="sm"
                    onClick={() => replyMutation.mutate()}
                    disabled={replyMutation.isPending || !replyContent.trim()}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    {isInternalNote ? "Add Note" : "Send Reply"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
