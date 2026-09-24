Errors:product-service :22:54:49.459 [DEBUG] [product-service] HTTP Request Started: GET /products/search
{
method: 'GET',
url: '/products/search',
requestId: undefined,
userId: undefined
}
22:54:49.820 [ERROR] [product-service] [Fatal/System Error] ConnectionError: Connection Error
ConnectionError: Connection Error
at ClientRequest.onError (/Users/taha/projects/microservices-ecommerce/node_modules/.pnpm/@opensearch-project+opensearch@3.6.0/node_modules/@opensearch-project/opensearch/lib/Connection.js:131:16)
at ClientRequest.emit (node:events:514:20)
at emitErrorEvent (node:\_http_client:114:11)
at Socket.socketErrorListener (node:\_http_client:768:5)
at Socket.emit (node:events:514:20)
at emitErrorNT (node:internal/streams/destroy:170:8)
at emitErrorCloseNT (node:internal/streams/destroy:129:3)
at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
22:54:49.825 [ERROR] [product-service] HTTP 500 GET /products/search (366.11ms)
{
method: 'GET',
url: '/products/search',
statusCode: 500,
durationMs: 366.11,
requestId: undefined,
userId: undefined
}
22:55:33.720 [DEBUG] [product-service] HTTP Request Started: GET /products/search
{
method: 'GET',
url: '/products/search',
requestId: undefined,
userId: undefined
}
22:55:33.739 [ERROR] [product-service] [Fatal/System Error] ConnectionError: Connection Error
ConnectionError: Connection Error
at ClientRequest.onError (/Users/taha/projects/microservices-ecommerce/node_modules/.pnpm/@opensearch-project+opensearch@3.6.0/node_modules/@opensearch-project/opensearch/lib/Connection.js:131:16)
at ClientRequest.emit (node:events:514:20)
at emitErrorEvent (node:\_http_client:114:11)
at Socket.socketErrorListener (node:\_http_client:768:5)
at Socket.emit (node:events:514:20)
at emitErrorNT (node:internal/streams/destroy:170:8)
at emitErrorCloseNT (node:internal/streams/destroy:129:3)
at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
22:55:33.740 [ERROR] [product-service] HTTP 500 GET /products/search (20.43ms)
{
method: 'GET',
url: '/products/search',
statusCode: 500,
durationMs: 20.43,
requestId: undefined,
userId: undefined
}
22:56:00.964 [DEBUG] [product-service] HTTP Request Started: GET /products/search
{
method: 'GET',
url: '/products/search',
requestId: undefined,
userId: undefined
}
22:56:01.006 [ERROR] [product-service] [Fatal/System Error] ConnectionError: Connection Error
ConnectionError: Connection Error
at ClientRequest.onError (/Users/taha/projects/microservices-ecommerce/node_modules/.pnpm/@opensearch-project+opensearch@3.6.0/node_modules/@opensearch-project/opensearch/lib/Connection.js:131:16)
at ClientRequest.emit (node:events:514:20)
at emitErrorEvent (node:\_http_client:114:11)
at Socket.socketErrorListener (node:\_http_client:768:5)
at Socket.emit (node:events:514:20)
at emitErrorNT (node:internal/streams/destroy:170:8)
at emitErrorCloseNT (node:internal/streams/destroy:129:3)
at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
22:56:01.012 [ERROR] [product-service] HTTP 500 GET /products/search (47.1ms)
{
method: 'GET',
url: '/products/search',
statusCode: 500,
durationMs: 47.1,
requestId: undefined,
userId: undefined
}Admin-service :Its always redirect into /unauthorized when I do the login from the clerk where the clerk authentication is perfectly working on the client ○ Compiling middleware ...
✓ Compiled middleware in 1433ms
✓ Ready in 14.4s
○ Compiling /unauthorized ...
(node:7165) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
✓ Compiled /unauthorized in 6.5s
(node:210) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
GET /unauthorized 200 in 8162ms
○ Compiling /favicon.ico ...
✓ Compiled /favicon.ico in 789ms
GET /favicon.ico?favicon.de19e2aa.ico 200 in 1209ms
POST /unauthorized 200 in 133ms
GET /unauthorized 200 in 67ms
POST /unauthorized 200 in 69ms
GET /unauthorized 200 in 65ms
POST /unauthorized 200 in 456ms
GET /favicon.ico?favicon.de19e2aa.ico 200 in 1194ms
GET /unauthorized 200 in 68ms
POST /unauthorized 200 in 493mssearch-service: {"level":"WARN","timestamp":"2026-09-23T22:47:48.645Z","logger":"kafkajs","message":"KafkaJS v2.0.0 switched default partitioner. To retain the same partitioning behavior as in previous versions, create the producer with the option \"createPartitioner: Partitioners.LegacyPartitioner\". See the migration guide at https://kafka.js.org/docs/migration-guide-v2.0.0#producer-new-default-partitioner for details. Silence this warning by setting the environment variable \"KAFKAJS_NO_PARTITIONER_WARNING=1\""}
22:47:49.119 [INFO ] [search-service] OpenTelemetry OTLP tracing enabled
{ service: 'search-service', endpoint: 'http://localhost:4318' }
(node:99903) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
22:47:49.531 [INFO ] [search-service] Initializing OpenSearch client → http://localhost:9200
22:47:52.989 [INFO ] [search-service] [search-service] Redis connected
{ url: 'redis://localhost:6379' }
22:47:53.006 [INFO ] [search-service] [search-service] Redis client ready
22:47:53.097 [ERROR] [search-service] Failed to ensure product index products-v1 exists
Error: [object Object]
at Logger.error (/Users/taha/projects/microservices-ecommerce/packages/monitoring/src/logger.ts:130:13)
at ensureProductIndexExists (/Users/taha/projects/microservices-ecommerce/packages/opensearch/src/indexes/products.index.ts:48:13)
at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
at async bootstrap (/Users/taha/projects/microservices-ecommerce/apps/search-service/src/server.ts:50:5)
22:47:53.135 [WARN ] [search-service] OpenSearch index check failed on startup (will retry on incoming events/queries)
{
error: {
name: 'ConnectionError',
message: 'Connection Error',
stack: 'ConnectionError: Connection Error\n' +
' at ClientRequest.onError (/Users/taha/projects/microservices-ecommerce/node_modules/.pnpm/@opensearch-project+opensearch@3.6.0/node_modules/@opensearch-project/opensearch/lib/Connection.js:131:16)\n' +
' at ClientRequest.emit (node:events:514:20)\n' +
' at emitErrorEvent (node:\_http_client:114:11)\n' +
' at Socket.socketErrorListener (node:\_http_client:768:5)\n' +
' at Socket.emit (node:events:514:20)\n' +
' at emitErrorNT (node:internal/streams/destroy:170:8)\n' +
' at emitErrorCloseNT (node:internal/streams/destroy:129:3)\n' +
' at process.processTicksAndRejections (node:internal/process/task_queues:90:21)',
meta: { body: null, statusCode: null, headers: null, meta: [Object] }
}
}
(node:99903) TimeoutNegativeWarning: -1790203673188 is a negative number.
Timeout duration was set to 1.
22:47:53.257 [INFO ] [kafka-consumer:search-service-group] Kafka consumer connected for group [search-service-group]
22:47:53.257 [INFO ] [search-service] Kafka consumer connected for group: search-service-group
{"level":"INFO","timestamp":"2026-09-23T22:47:53.335Z","logger":"kafkajs","message":"[Consumer] Starting","groupId":"search-service-group"}
{"level":"INFO","timestamp":"2026-09-23T22:47:53.604Z","logger":"kafkajs","message":"[ConsumerGroup] Consumer has joined the group","groupId":"search-service-group","memberId":"search-service-67b3a8e3-1d36-45f2-9c59-96687aa2639d","leaderId":"search-service-67b3a8e3-1d36-45f2-9c59-96687aa2639d","isLeader":true,"memberAssignment":{"product.created":[0,1,2],"product.updated":[0,1,2],"product.deleted":[0,1,2]},"groupProtocol":"RoundRobinAssigner","duration":260}
22:47:53.607 [INFO ] [search-service] Subscribed to product event topics successfully
22:47:53.671 [INFO ] [search-service] Search service listening on http://0.0.0.0:8006Shipping-service :{"level":"WARN","timestamp":"2026-09-23T22:47:52.719Z","logger":"kafkajs","message":"KafkaJS v2.0.0 switched default partitioner. To retain the same partitioning behavior as in previous versions, create the producer with the option \"createPartitioner: Partitioners.LegacyPartitioner\". See the migration guide at https://kafka.js.org/docs/migration-guide-v2.0.0#producer-new-default-partitioner for details. Silence this warning by setting the environment variable \"KAFKAJS_NO_PARTITIONER_WARNING=1\""}
[ShippingService] Initializing shipping-service on port 8011...
[ShippingService] Carrier provider registry initialized (TCS, Leopards, DHL, FedEx, Custom)
(node:150) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
[shipping-service] Redis connected { url: 'redis://localhost:6379' }
[shipping-service] Redis client ready
[ShippingService] Shipping methods validated/seeded in PostgreSQL
(node:150) TimeoutNegativeWarning: -1790203673444 is a negative number.
Timeout duration was set to 1.
22:47:53.451 [INFO ] [kafka-producer] Kafka producer connected successfully
[ShippingService] Kafka producer connected
{"level":"INFO","timestamp":"2026-09-23T22:47:53.508Z","logger":"kafkajs","message":"[Consumer] Starting","groupId":"shipping-service-group"}
{"level":"INFO","timestamp":"2026-09-23T22:47:54.162Z","logger":"kafkajs","message":"[ConsumerGroup] Consumer has joined the group","groupId":"shipping-service-group","memberId":"shipping-service-22d0dd51-4c24-4711-8758-9b6ae9b9161a","leaderId":"shipping-service-22d0dd51-4c24-4711-8758-9b6ae9b9161a","isLeader":true,"memberAssignment":{"order.created":[0,1,2],"order.cancelled":[0,1,2]},"groupProtocol":"RoundRobinAssigner","duration":649}
22:47:54.188 [ERROR] [kafka-consumer:shipping-service-group] [Fatal/System Error] KafkaJSNonRetriableError: Cannot subscribe to topic while consumer is running
KafkaJSNonRetriableError: Cannot subscribe to topic while consumer is running
at Object.subscribe (/Users/taha/projects/microservices-ecommerce/node_modules/.pnpm/kafkajs@2.2.4/node_modules/kafkajs/src/consumer/index.js:136:13)
at Object.subscribe (/Users/taha/projects/microservices-ecommerce/packages/kafka/src/consumer.ts:29:22)
at startPaymentConsumer (/Users/taha/projects/microservices-ecommerce/apps/shipping-service/src/consumers/payment.consumer.ts:8:18)
at main (/Users/taha/projects/microservices-ecommerce/apps/shipping-service/src/index.ts:39:11)
at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[ShippingService] Kafka integration unavailable; running in HTTP-only resilient mode: Cannot subscribe to topic while consumer is runningrecomendation-service :uv run fastapi dev app/main.py

⚡️ Starting FastAPI in development mode

🐍 Using import string: app.main:app

🌐 Server started at http://127.0.0.1:8000
Documentation at http://127.0.0.1:8000/docs

Logs:

▕ Will watch for changes in these directories: ['/Users/taha/projects/microservices-ecommerce/apps/recommendation-service']
▕ Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
▕ Started reloader process [61954] using WatchFiles
▕ Started server process [62154]
▕ Waiting for application startup.
2026-09-23T22:01:13.989334Z [info ] service_starting [main] env=development service=recommendation-service
2026-09-23T22:01:14.672932Z [info ] redis_connected [main]
2026-09-23T22:01:14.677964Z [info ] all_kafka_consumers_registered [event_consumer]
2026-09-23T22:01:14.678303Z [info ] starting_kafka_consumer [kafka_consumer] bootstrap_servers=localhost:9094,localhost:9095,localhost:9096 group_id=recommendation-service topics=['product.created', 'product.updated', 'product.deleted', 'payment.successful', 'payment-successful', 'order.created', 'order.completed', 'order-successful', 'product.viewed', 'product.searched', 'product.added_to_cart', 'product.removed_from_cart', 'cart.item_added', 'cart.item_removed', 'wishlist.product_added', 'recommendation.interaction', 'review.created']
2026-09-23T22:01:15.257362Z [error ] Topic review.created not found in cluster metadata [aiokafka.cluster]
2026-09-23T22:01:15.258233Z [error ] Topic recommendation.interaction not found in cluster metadata [aiokafka.cluster]
2026-09-23T22:01:15.258447Z [error ] Topic product.added_to_cart not found in cluster metadata [aiokafka.cluster]
2026-09-23T22:01:15.258530Z [error ] Topic cart.item_removed not found in cluster metadata [aiokafka.cluster]
2026-09-23T22:01:15.258630Z [error ] Topic cart.item_added not found in cluster metadata [aiokafka.cluster]
2026-09-23T22:01:15.258970Z [error ] Topic wishlist.product_added not found in cluster metadata [aiokafka.cluster]
2026-09-23T22:01:15.259251Z [error ] Topic product.removed_from_cart not found in cluster metadata [aiokafka.cluster]
2026-09-23T22:01:15.259357Z [error ] Topic product.viewed not found in cluster metadata [aiokafka.cluster]
2026-09-23T22:01:15.260833Z [error ] Topic order.completed not found in cluster metadata [aiokafka.cluster]
2026-09-23T22:01:15.262626Z [error ] Topic product.searched not found in cluster metadata [aiokafka.cluster]
2026-09-23T22:01:15.818888Z [info ] kafka_consumer_started_successfully [kafka_consumer] topics=['product.created', 'product.updated', 'product.deleted', 'payment.successful', 'payment-successful', 'order.created', 'order.completed', 'order-successful', 'product.viewed', 'product.searched', 'product.added_to_cart', 'product.removed_from_cart', 'cart.item_added', 'cart.item_removed', 'wishlist.product_added', 'recommendation.interaction', 'review.created']
2026-09-23T22:01:15.848070Z [info ] kafka_producer_started [kafka_producer]
▕ Application startup complete.
2026-09-23T22:01:16.008494Z [error ] Failed fetch offsets from 3: [Error 6] NotLeaderForPartitionError: TopicPartition(topic='product.searched', partition=0) [aiokafka.consumer.fetcher]
2026-09-23T22:01:16.035638Z [error ] Failed fetch offsets from 1: [Error 6] NotLeaderForPartitionError: TopicPartition(topic='product.searched', partition=1) [aiokafka.consumer.fetcher]
2026-09-23T22:01:16.075269Z [error ] Failed fetch offsets from 2: [Error 6] NotLeaderForPartitionError: TopicPartition(topic='product.searched', partition=2) [aiokafka.consumer.fetcher]
2026-09-23T22:01:16.152514Z [error ] Failed fetch offsets from 1: [Error 6] NotLeaderForPartitionError: TopicPartition(topic='product.searched', partition=1) [aiokafka.consumer.fetcher]
2026-09-23T22:01:16.167842Z [error ] Failed fetch offsets from 3: [Error 6] NotLeaderForPartitionError: TopicPartition(topic='product.searched', partition=0) [aiokafka.consumer.fetcher]
2026-09-23T22:01:16.214007Z [error ] Failed fetch offsets from 2: [Error 6] NotLeaderForPartitionError: TopicPartition(topic='product.searched', partition=2) [aiokafka.consumer.fetcher]
2026-09-23T22:01:16.281113Z [error ] Failed fetch offsets from 1: [Error 6] NotLeaderForPartitionError: TopicPartition(topic='product.searched', partition=1) [aiokafka.consumer.fetcher]
2026-09-23T22:01:16.285335Z [error ] Failed fetch offsets from 3: [Error 6] NotLeaderForPartitionError: TopicPartition(topic='order.completed', partition=2) [aiokafka.consumer.fetcher]
