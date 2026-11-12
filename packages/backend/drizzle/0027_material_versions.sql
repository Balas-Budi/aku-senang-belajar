CREATE TYPE "public"."material_licence" AS ENUM('own', 'school', 'open', 'permission');--> statement-breakpoint
CREATE TABLE "material_versions" (
	"material_id" integer NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_versions_material_id_version_pk" PRIMARY KEY("material_id","version")
);
--> statement-breakpoint
ALTER TABLE "material_chunks" DROP CONSTRAINT "material_chunks_material_id_page_number_position_unique";--> statement-breakpoint
ALTER TABLE "material_pages" DROP CONSTRAINT "material_pages_material_id_number_pk";--> statement-breakpoint
ALTER TABLE "material_chunks" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "material_pages" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "material_pages" ADD CONSTRAINT "material_pages_material_id_version_number_pk" PRIMARY KEY("material_id","version","number");--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "licence" "material_licence";--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "licence_note" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "material_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "material_versions" ADD CONSTRAINT "material_versions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_chunks" ADD CONSTRAINT "material_chunks_material_id_version_page_number_position_unique" UNIQUE("material_id","version","page_number","position");--> statement-breakpoint
INSERT INTO "material_versions" ("material_id", "version", "created_at") SELECT "id", 1, "created_at" FROM "materials";
