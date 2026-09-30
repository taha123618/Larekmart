DROP INDEX "media_jobs_status_idx";--> statement-breakpoint
DROP INDEX "media_uploads_status_idx";--> statement-breakpoint
DROP INDEX "media_uploads_expires_idx";--> statement-breakpoint
DROP INDEX "media_variants_media_idx";--> statement-breakpoint
CREATE INDEX "media_jobs_status_created_idx" ON "media_processing_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "media_uploads_status_expires_idx" ON "media_uploads" USING btree ("status","expires_at");