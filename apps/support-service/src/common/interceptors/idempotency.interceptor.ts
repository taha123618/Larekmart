import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Inject,
} from "@nestjs/common";
import { Observable, from, of } from "rxjs";
import { switchMap, tap, catchError } from "rxjs/operators";
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  acquireIdempotencyLock,
  commitIdempotencyResponse,
  releaseIdempotencyLock,
  type IdempotentResponse,
} from "@repo/redis";
import { RedisService } from "../../redis/redis.service.js";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(RedisService)
    private readonly redisService: RedisService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const rawKey =
      (request.headers["idempotency-key"] as string | undefined) ||
      (request.headers["Idempotency-Key"] as string | undefined);

    if (!rawKey || typeof rawKey !== "string" || rawKey.trim().length === 0) {
      return next.handle();
    }

    const client = this.redisService.getClient();
    const keys = this.redisService.getKeys();

    if (
      !client ||
      !keys ||
      (client.status !== "ready" && client.status !== "connect")
    ) {
      return next.handle();
    }

    const userId = request.user?.userId || "anon";
    const redisKey = keys.simple(`support:idemp:${userId}:${rawKey.trim()}`);

    return from(
      acquireIdempotencyLock(client, redisKey, {
        lockTtlMs: 10000,
        retentionTtlSec: 86400,
      }),
    ).pipe(
      switchMap((lockResult) => {
        if (lockResult.status === "replayed") {
          reply.header("Idempotent-Replayed", "true");
          reply.header("x-idempotent-replay", "true");
          return of(lockResult.response.body);
        }

        if (lockResult.status === "conflict") {
          throw new ConflictException(
            "A mutation with this Idempotency-Key is currently in-flight",
          );
        }

        return next.handle().pipe(
          tap(async (responseBody) => {
            const responsePayload: IdempotentResponse = {
              statusCode: reply.statusCode || 200,
              body: responseBody,
            };
            await commitIdempotencyResponse(client, redisKey, responsePayload, {
              retentionTtlSec: 86400,
            }).catch(() => {});
          }),
          catchError((err) => {
            releaseIdempotencyLock(client, redisKey).catch(() => {});
            throw err;
          }),
        );
      }),
    );
  }
}
