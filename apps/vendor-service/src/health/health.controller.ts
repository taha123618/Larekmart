import { Controller, Get, Res, HttpStatus } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { PrismaService } from "../database/prisma.service.js";

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  health() {
    return {
      status: "ok",
      service: "vendor-service",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get("api/v1/vendors/health")
  apiHealth() {
    return this.health();
  }

  @Get("ready")
  async readiness(@Res() res: FastifyReply) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return res.status(HttpStatus.OK).send({
        status: "ready",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
        status: "not_ready",
        database: "disconnected",
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get("metrics")
  metrics(@Res() res: FastifyReply) {
    const memUsage = process.memoryUsage();
    const body = [
      "# HELP process_uptime_seconds Process uptime in seconds",
      "# TYPE process_uptime_seconds gauge",
      `process_uptime_seconds ${process.uptime()}`,
      "# HELP process_heap_bytes Process heap memory usage in bytes",
      "# TYPE process_heap_bytes gauge",
      `process_heap_bytes ${memUsage.heapUsed}`,
    ].join("\n");

    res.header("Content-Type", "text/plain").send(body);
  }
}
