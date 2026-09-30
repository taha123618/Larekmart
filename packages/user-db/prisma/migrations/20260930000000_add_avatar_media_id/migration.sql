-- Add avatarMediaId to user_profiles.
-- Media reference (media-service) — preferred over avatar_url for new avatars.
-- Nullable: legacy profiles keep using avatar_url; no backfill required.

ALTER TABLE "user_profiles" ADD COLUMN "avatar_media_id" TEXT;
