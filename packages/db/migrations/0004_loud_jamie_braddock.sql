ALTER TABLE "user" DROP CONSTRAINT "user_approval_token_unique";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "approval_token";