ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "approval_token" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_approval_token_unique" UNIQUE("approval_token");--> statement-breakpoint
-- Existing accounts also enter the approval queue; no automatic administrator grants.
UPDATE "user" SET "approval_token" = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') WHERE "approved" = false AND "approval_token" IS NULL;
