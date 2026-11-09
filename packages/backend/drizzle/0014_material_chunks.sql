CREATE TABLE "material_chunks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_chunks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"material_id" integer NOT NULL,
	"page_number" integer NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1536),
	"tries" integer DEFAULT 0 NOT NULL,
	"embed_after" timestamp with time zone DEFAULT now() NOT NULL,
	"embedded_at" timestamp with time zone,
	CONSTRAINT "material_chunks_material_id_page_number_position_unique" UNIQUE("material_id","page_number","position")
);
--> statement-breakpoint
ALTER TABLE "material_chunks" ADD CONSTRAINT "material_chunks_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_chunks_embedding_idx" ON "material_chunks" USING hnsw ("embedding" vector_cosine_ops);