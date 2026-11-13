#!/usr/bin/env node
/**
 * @file cli.ts
 * @description Operator command-line tool for Kafka DLQ discovery, inspection, and safe replay.
 * Usage:
 *   pnpm dlq list [filter]
 *   pnpm dlq inspect <topic> [limit]
 *   pnpm dlq replay <topic> <partition> <offset> [--by <operator>]
 */

import { createKafkaClient } from "../client.js";
import {
  discoverDlqTopics,
  getDlqTopicSummaries,
  fetchDlqRecords,
} from "./inspector.js";
import { replayDeadLetter, replayDeadLettersBatch } from "./replayer.js";
import { runDlqMirrorWorker } from "./mirror-worker.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  const kafka = createKafkaClient("dlq-cli");
  const admin = kafka.admin();

  try {
    switch (command) {
      case "list":
      case "topics": {
        const filter = args[1];
        await admin.connect();
        console.log(
          `\n🔍 Scanning Kafka cluster for Dead-Letter Queue (DLQ) topics...`,
        );
        const summaries = await getDlqTopicSummaries(admin, filter);
        await admin.disconnect();

        if (summaries.length === 0) {
          console.log(
            `✅ No DLQ topics found${filter ? ` matching "${filter}"` : ""}. All clean!\n`,
          );
          return;
        }

        console.log(`\nFound ${summaries.length} DLQ Topic(s):`);
        console.table(
          summaries.map((s) => ({
            "DLQ Topic": s.topic,
            "Source Topic": s.originalTopic,
            Partitions: s.partitions,
            "Dead Messages": s.totalMessages,
            "Offset Range": `${s.oldestOffset}..${s.latestOffset}`,
          })),
        );
        console.log(`\nTo inspect messages: pnpm dlq inspect <topic>\n`);
        break;
      }

      case "inspect": {
        const topic = args[1];
        if (!topic || topic.startsWith("-")) {
          console.error(
            "❌ Error: Topic argument is required. Usage: pnpm dlq inspect <topic> [limit]",
          );
          process.exit(1);
        }

        const limit = parseInt(args[2] || "10", 10);
        console.log(`\n🔍 Fetching up to ${limit} records from [${topic}]...`);

        const records = await fetchDlqRecords(kafka, { topic, limit });
        if (records.length === 0) {
          console.log(`✅ No messages found in topic [${topic}].\n`);
          return;
        }

        console.log(`\nRetrieved ${records.length} dead-letter records:`);
        console.table(
          records.map((r) => ({
            ID: r.id,
            P: r.partition,
            Offset: r.offset,
            "Poison Pill": r.isPoisonPill ? "⚠️ YES" : "No",
            "Error Name": r.errorName.slice(0, 24),
            "Error Message": r.errorMessage.slice(0, 40),
            Attempts: r.attemptCount,
            Replays: r.replayCount,
            Status: r.status,
            "Failed At": r.failedAt.slice(0, 19).replace("T", " "),
          })),
        );

        const latest = records[0];
        if (!latest) {
          return;
        }

        console.log(`\nDetailed inspection of latest failure:`);
        console.log(`  • ID: ${latest.id}`);
        console.log(`  • Error: ${latest.errorName} — ${latest.errorMessage}`);
        if (latest.errorStack) {
          console.log(
            `  • Stack: ${latest.errorStack.split("\n").slice(0, 3).join("\n    ")}`,
          );
        }
        console.log(
          `  • Payload Preview: ${latest.rawPayload.slice(0, 200)}...`,
        );
        console.log(
          `\nTo replay a record: pnpm dlq replay ${latest.dlqTopic} ${latest.partition} ${latest.offset}\n`,
        );
        break;
      }

      case "replay": {
        const topic = args[1];
        const partition = parseInt(args[2] || "0", 10);
        const offset = args[3];

        if (!topic || isNaN(partition) || !offset) {
          console.error(
            "❌ Error: Missing parameters. Usage: pnpm dlq replay <topic> <partition> <offset>",
          );
          process.exit(1);
        }

        const operatorIndex = args.indexOf("--by");
        const replayedBy: string =
          operatorIndex !== -1 && args[operatorIndex + 1]
            ? String(args[operatorIndex + 1])
            : `cli:${process.env.USER || "operator"}`;

        console.log(
          `\n🔄 Preparing replay for [${topic}] partition ${partition} offset ${offset}...`,
        );

        const records = await fetchDlqRecords(kafka, {
          topic,
          partition,
          limit: 100,
        });

        const targetRecord = records.find((r) => r.offset === offset);
        if (!targetRecord) {
          console.error(
            `❌ Could not locate record with offset ${offset} in topic [${topic}].`,
          );
          process.exit(1);
        }

        console.log(`Found record: Error was "${targetRecord.errorMessage}".`);
        console.log(`Current replay count: ${targetRecord.replayCount}`);

        const result = await replayDeadLetter(kafka, targetRecord, {
          recordId: targetRecord.id,
          dlqTopic: topic,
          partition,
          offset,
          replayedBy,
        });

        if (result.success) {
          if (result.routedToGraveyard) {
            console.log(
              `⚠️ Record exceeded max replay threshold! Diverted to graveyard topic: [${result.targetTopic}]`,
            );
          } else {
            console.log(
              `✅ Successfully replayed message to target topic: [${result.targetTopic}] (Replay count: ${result.replayCount})`,
            );
          }
        } else {
          console.error(`❌ Replay failed: ${result.error}`);
          process.exit(1);
        }
        break;
      }

      case "replay-topic": {
        const topic = args[1];
        if (!topic || topic.startsWith("-")) {
          console.error(
            "❌ Error: Topic required. Usage: pnpm dlq replay-topic <topic> [limit] [--by <operator>]",
          );
          process.exit(1);
        }

        const limit = parseInt(args[2] || "100", 10);
        const operatorIndex = args.indexOf("--by");
        const replayedBy: string =
          operatorIndex !== -1 && args[operatorIndex + 1]
            ? String(args[operatorIndex + 1])
            : `cli:${process.env.USER || "operator"}`;

        console.log(
          `\n🔄 Fetching up to ${limit} pending dead letters from [${topic}]...`,
        );
        const records = await fetchDlqRecords(kafka, { topic, limit });
        const pending = records.filter(
          (r) => r.status === "PENDING" && !r.isPoisonPill,
        );

        if (pending.length === 0) {
          console.log(
            `✅ No eligible pending records to replay in [${topic}].\n`,
          );
          return;
        }

        console.log(
          `Replaying ${pending.length} eligible record(s) to original topic [${pending[0]?.originalTopic}]...`,
        );
        const results = await replayDeadLettersBatch(kafka, pending, {
          replayedBy,
        });
        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        console.log(
          `\n🎉 Batch replay complete: ${succeeded} succeeded, ${failed} failed.\n`,
        );
        break;
      }

      case "mirror":
      case "worker": {
        const opensearchNode = args[1];
        await runDlqMirrorWorker(kafka, opensearchNode);
        break;
      }

      case "help":
      default: {
        printHelp();
        break;
      }
    }
  } catch (error) {
    console.error("❌ Fatal DLQ CLI error:", error);
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
============================================================
🛡️  Larekmart Kafka DLQ Inspector & Replay CLI
============================================================

Commands:
  pnpm dlq list [filter]
    Discover all DLQ topics, partition counts, and unread dead letters.

  pnpm dlq inspect <topic> [limit]
    Inspect failed records, error stacks, headers, and poison pills.

  pnpm dlq replay <topic> <partition> <offset> [--by <operator>]
    Safely republish a dead letter to its original topic with
    provenance headers and loop-prevention guards.

  pnpm dlq replay-topic <topic> [limit] [--by <operator>]
    Safely replay all pending dead letters in a DLQ topic in batch.

  pnpm dlq mirror [opensearchNode]
    Run real-time background daemon indexing DLQ events into OpenSearch.

Examples:
  pnpm dlq list
  pnpm dlq inspect fraud.case.created.dlq 5
  pnpm dlq replay fraud.case.created.dlq 0 102 --by admin_ops
  pnpm dlq replay-topic fraud.case.created.dlq 50
  pnpm dlq mirror
============================================================
  `);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
