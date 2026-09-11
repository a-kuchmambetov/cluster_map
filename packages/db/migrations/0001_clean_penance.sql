ALTER TABLE "position" DROP CONSTRAINT "position_holder_id_user_hive_info_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "position" ADD CONSTRAINT "position_holder_id_user_hive_info_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."user_hive_info"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "position" ADD CONSTRAINT "position_occupancy_consistent" CHECK (("position"."occupied" = false AND "position"."holder_id" IS NULL AND "position"."taken_at" IS NULL)
                OR ("position"."occupied" = true AND "position"."holder_id" IS NOT NULL AND "position"."taken_at" IS NOT NULL));