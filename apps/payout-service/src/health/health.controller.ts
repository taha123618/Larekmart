import { Controller, Get, Res } from "@nestjs/common";
import { checkDbHealth } from "../db/connection.js";
import type { FastifyReply } from "fastify";

@Controller()
export class HealthController {
  @Get("health")
  async getHealth() {
    const isDbAlive = await checkDbHealth();
    return {
      status: isDbAlive ? "UP" : "DEGRADED",
      service: "payout-service",
      timestamp: new Date().toISOString(),
      database: isDbAlive ? "connected" : "disconnected",
    };
  }

  @Get("ready")
  async getReady(@Res({ passthrough: true }) res: FastifyReply) {
    const isDbAlive = await checkDbHealth();
    if (!isDbAlive) {
      res.status(503);
      return { status: "NOT_READY", service: "payout-service" };
    }
    return { status: "READY", service: "payout-service" };
  }

  @Get("metrics")
  async getMetrics(@Res({ passthrough: true }) res: FastifyReply) {
    res.header("Content-Type", "text/plain; version=0.0.4");
    return [
      "# HELP payout_disbursements_total Total payout disbursements executed",
      "# TYPE payout_disbursements_total counter",
      'payout_disbursements_total{status="SUCCESS"} 0',
      "# HELP payout_ledger_transactions_total Total balanced double-entry transactions posted",
      "# TYPE payout_ledger_transactions_total counter",
      "payout_ledger_transactions_total 0",
    ].join("\n");
  }
}
