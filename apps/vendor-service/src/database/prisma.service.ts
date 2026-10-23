import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@repo/vendor-db";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("Prisma connected to vendor_db successfully");
    } catch (err) {
      if (process.env.NODE_ENV === "test") {
        this.logger.warn(
          `[PrismaService] Database connection skipped in test environment: ${(err as Error).message}`,
        );
      } else {
        throw err;
      }
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      // safe ignore on teardown
    }
  }
}
