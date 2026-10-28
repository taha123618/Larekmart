import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { DatabaseModule } from "./database/database.module.js";
import { KafkaModule } from "./kafka/kafka.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { HealthModule } from "./health/health.module.js";
import { VendorsModule } from "./modules/vendors/vendors.module.js";
import { DocumentsModule } from "./modules/documents/documents.module.js";
import { AdminVendorsModule } from "./modules/admin/admin-vendors.module.js";
import { SettlementsModule } from "./modules/settlements/settlements.module.js";
import { DisputesModule } from "./modules/disputes/disputes.module.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";

@Module({
  imports: [
    DatabaseModule,
    KafkaModule,
    RedisModule,
    HealthModule,
    VendorsModule,
    DocumentsModule,
    AdminVendorsModule,
    SettlementsModule,
    DisputesModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
