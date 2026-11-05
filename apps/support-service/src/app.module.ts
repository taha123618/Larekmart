import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { DatabaseModule } from "./database/database.module.js";
import { KafkaModule } from "./kafka/kafka.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { HealthModule } from "./health/health.module.js";
import { CategoriesModule } from "./modules/categories/categories.module.js";
import { SlaModule } from "./modules/sla/sla.module.js";
import { TicketsModule } from "./modules/tickets/tickets.module.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";

@Module({
  imports: [
    DatabaseModule,
    KafkaModule,
    RedisModule,
    RealtimeModule,
    HealthModule,
    CategoriesModule,
    SlaModule,
    TicketsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
