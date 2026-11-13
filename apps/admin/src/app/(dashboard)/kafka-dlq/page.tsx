"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAdminDlqTopics,
  fetchAdminDlqRecords,
  replayAdminDlqRecord,
  type DeadLetterRecord,
} from "@/services/dlq.service";
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
  Radio,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  RotateCw,
  Eye,
  ShieldAlert,
  Layers,
  FileCode,
  Send,
  Database,
} from "lucide-react";
import { toast } from "react-toastify";

export default function KafkaDlqDashboardPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTopic, setSelectedTopic] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRecord, setSelectedRecord] = useState<DeadLetterRecord | null>(
    null,
  );
  const [editedPayload, setEditedPayload] = useState<string>("");
  const [isEditingPayload, setIsEditingPayload] = useState<boolean>(false);

  // 1. Fetch DLQ Topics Summary
  const {
    data: topics = [],
    isLoading: isTopicsLoading,
    refetch: refetchTopics,
  } = useQuery({
    queryKey: ["admin-dlq-topics"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminDlqTopics(token);
    },
  });

  // 2. Fetch Dead-Letter Records
  const {
    data: recordsData,
    isLoading: isRecordsLoading,
    refetch: refetchRecords,
  } = useQuery({
    queryKey: ["admin-dlq-records", selectedTopic, statusFilter, searchQuery],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminDlqRecords(
        {
          topic: selectedTopic,
          status: statusFilter,
          query: searchQuery,
          limit: 50,
        },
        token,
      );
    },
  });

  const records = recordsData?.records || [];

  // 3. Replay Mutation
  const replayMutation = useMutation({
    mutationFn: async (params: {
      record: DeadLetterRecord;
      modifiedPayload?: string;
    }) => {
      const token = await getToken();
      return replayAdminDlqRecord(
        {
          recordId: params.record.id,
          dlqTopic: params.record.dlqTopic,
          partition: params.record.partition,
          offset: params.record.offset,
          modifiedPayload: params.modifiedPayload,
          maxReplayThreshold: 3,
        },
        token,
      );
    },
    onSuccess: (res) => {
      toast.success(res.message || "Message replayed successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-dlq-records"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dlq-topics"] });
      setSelectedRecord(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Replay failed");
    },
  });

  const handleOpenInspector = (record: DeadLetterRecord) => {
    setSelectedRecord(record);
    setEditedPayload(
      record.parsedPayload
        ? JSON.stringify(record.parsedPayload, null, 2)
        : record.rawPayload,
    );
    setIsEditingPayload(false);
  };

  const handleExecuteReplay = () => {
    if (!selectedRecord) return;
    replayMutation.mutate({
      record: selectedRecord,
      modifiedPayload: isEditingPayload ? editedPayload : undefined,
    });
  };

  // Metrics aggregations
  const totalDeadLetters = topics.reduce((acc, t) => acc + t.totalMessages, 0);
  const poisonPillsCount = records.filter((r) => r.isPoisonPill).length;
  const repeatReplaysCount = records.filter((r) => r.replayCount > 0).length;

  return (
    <div className="flex flex-col gap-6 p-4 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-destructive animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">
              Kafka DLQ & Resilience Operations
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time dead-letter inspection, poison-pill isolation, and guarded
            replay engine across 186 topics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchTopics();
              refetchRecords();
            }}
            disabled={isTopicsLoading || isRecordsLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isTopicsLoading || isRecordsLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monitored DLQ Topics
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topics.length}</div>
            <p className="text-xs text-muted-foreground">
              Active dead-letter partitions
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Unresolved Dead Letters
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {totalDeadLetters}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending manual or automated review
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Poison Pills Trapped
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {poisonPillsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Malformed JSON / schema violations
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Repeat Replays
            </CardTitle>
            <RotateCw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {repeatReplaysCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Tracked by x-larekmart-replay-count
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="shadow-xs">
        <CardContent className="pt-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search error, stacktrace, payload..."
                className="pl-8 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="h-9 px-3 py-1 rounded-md border border-input bg-background text-sm ring-offset-background"
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
            >
              <option value="ALL">All DLQ Topics</option>
              {topics.map((t) => (
                <option key={t.topic} value={t.originalTopic}>
                  {t.topic} ({t.totalMessages})
                </option>
              ))}
            </select>

            <select
              className="h-9 px-3 py-1 rounded-md border border-input bg-background text-sm ring-offset-background"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="REPLAYED">Replayed</option>
            </select>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Database className="h-3.5 w-3.5" />
            Source:{" "}
            <span className="font-semibold text-foreground">
              {recordsData?.source || "syncing"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Dead-Letter Records Table */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                Dead-Letter Queue Backlog
              </CardTitle>
              <CardDescription>
                Showing {records.length} records matching your current filter
                criteria
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic & Partition</TableHead>
                <TableHead>Offset</TableHead>
                <TableHead>Error & Cause</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Replays</TableHead>
                <TableHead>Failed At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-10 text-muted-foreground"
                  >
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-75" />
                    No dead-letter messages found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs font-semibold">
                      {record.dlqTopic}
                      <span className="text-muted-foreground ml-1">
                        P{record.partition}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{record.offset}
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      <div className="font-semibold text-xs text-destructive flex items-center gap-1.5">
                        {record.errorName}
                      </div>
                      <div
                        className="text-xs text-muted-foreground truncate"
                        title={record.errorMessage}
                      >
                        {record.errorMessage}
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.isPoisonPill ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Poison Pill
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Transient Error
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {record.attemptCount}
                    </TableCell>
                    <TableCell className="text-xs">
                      {record.replayCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-blue-600 border-blue-300"
                        >
                          {record.replayCount}x
                        </Badge>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(record.failedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.status === "REPLAYED" ? "default" : "outline"
                        }
                        className="text-[10px]"
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={() => handleOpenInspector(record)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Inspect & Replay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inspector / Fix-and-Replay Sheet */}
      <Sheet
        open={!!selectedRecord}
        onOpenChange={(open) => !open && setSelectedRecord(null)}
      >
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedRecord && (
            <div className="flex flex-col gap-5 py-2">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  <SheetTitle className="text-lg">
                    Dead-Letter Message Inspector
                  </SheetTitle>
                </div>
                <SheetDescription>
                  Review error details, examine consumer stack trace, and
                  optionally fix the JSON payload before replaying.
                </SheetDescription>
              </SheetHeader>

              {/* Error Summary Card */}
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20 text-xs">
                <div className="font-semibold text-destructive mb-1 flex items-center justify-between">
                  <span>{selectedRecord.errorName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    Consumer: {selectedRecord.consumerGroup}
                  </Badge>
                </div>
                <div className="text-foreground/90 font-mono break-all">
                  {selectedRecord.errorMessage}
                </div>
              </div>

              {/* Stack Trace */}
              {selectedRecord.errorStack && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Error Stack Trace
                  </label>
                  <pre className="mt-1 p-2.5 bg-muted rounded-md text-[11px] font-mono overflow-x-auto max-h-36 text-muted-foreground">
                    {selectedRecord.errorStack}
                  </pre>
                </div>
              )}

              {/* Message Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-secondary/50 rounded-lg text-xs font-mono">
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    TARGET TOPIC
                  </span>
                  <span className="font-semibold">
                    {selectedRecord.originalTopic}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    PARTITION / OFFSET
                  </span>
                  <span>
                    P{selectedRecord.partition} : #{selectedRecord.offset}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    REPLAY COUNT
                  </span>
                  <span>{selectedRecord.replayCount} / 3 max</span>
                </div>
              </div>

              {/* Payload Fix & Inspection */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode className="h-3.5 w-3.5" />
                    Message Payload
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary"
                    onClick={() => setIsEditingPayload(!isEditingPayload)}
                  >
                    {isEditingPayload ? "Cancel Edit" : "Edit & Fix Payload"}
                  </Button>
                </div>

                {isEditingPayload ? (
                  <Textarea
                    className="font-mono text-xs min-h-[180px] bg-background"
                    value={editedPayload}
                    onChange={(e) => setEditedPayload(e.target.value)}
                  />
                ) : (
                  <pre className="p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto max-h-56 text-foreground">
                    {editedPayload}
                  </pre>
                )}
                {isEditingPayload && (
                  <p className="text-[11px] text-amber-600 font-medium">
                    ⚠️ Modifying payload will stamp{" "}
                    <code>x-larekmart-payload-modified: true</code> header upon
                    replay.
                  </p>
                )}
              </div>

              {/* Replay Actions */}
              <div className="pt-4 border-t flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRecord(null)}
                >
                  Close
                </Button>

                <Button
                  size="sm"
                  className="gap-2"
                  onClick={handleExecuteReplay}
                  disabled={replayMutation.isPending}
                >
                  <Send
                    className={`h-4 w-4 ${replayMutation.isPending ? "animate-spin" : ""}`}
                  />
                  {isEditingPayload
                    ? "Save & Replay to Topic"
                    : "Replay Message"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
