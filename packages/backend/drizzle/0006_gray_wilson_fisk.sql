CREATE TABLE "material_pages" (
	"material_id" integer NOT NULL,
	"number" integer NOT NULL,
	"text" text,
	CONSTRAINT "material_pages_material_id_number_pk" PRIMARY KEY("material_id","number")
);
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "grade" integer;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "rights_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "material_pages" ADD CONSTRAINT "material_pages_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "materials_owner_id_idx" ON "materials" USING btree ("owner_id");