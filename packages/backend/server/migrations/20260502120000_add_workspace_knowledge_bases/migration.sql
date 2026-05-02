-- CreateEnum
CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('active', 'trashed');

-- CreateEnum
CREATE TYPE "KnowledgeBaseSourceType" AS ENUM ('doc', 'container', 'containerFile', 'blob');

-- CreateEnum
CREATE TYPE "KnowledgeBaseSourceStatus" AS ENUM ('pending', 'indexed', 'stale', 'failed');

-- CreateEnum
CREATE TYPE "KnowledgeBaseSourceOverride" AS ENUM ('include', 'exclude');

-- CreateTable
CREATE TABLE "workspace_knowledge_bases" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "folder_node_id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "include_subfolders" BOOLEAN NOT NULL DEFAULT false,
    "selection_create_doc_min_lines" INTEGER NOT NULL DEFAULT 5,
    "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'active',
    "created_by" VARCHAR NOT NULL,
    "updated_by" VARCHAR,
    "deleted_by" VARCHAR,
    "last_parent_folder_node_id" VARCHAR,
    "last_index" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "workspace_knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_knowledge_base_sources" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "knowledge_base_id" VARCHAR NOT NULL,
    "source_type" "KnowledgeBaseSourceType" NOT NULL,
    "source_id" VARCHAR NOT NULL,
    "parent_folder_node_id" VARCHAR,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "manual_override" "KnowledgeBaseSourceOverride",
    "status" "KnowledgeBaseSourceStatus" NOT NULL DEFAULT 'pending',
    "content_hash" VARCHAR,
    "indexed_at" TIMESTAMPTZ(3),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_knowledge_base_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_knowledge_base_embeddings" (
    "id" VARCHAR NOT NULL,
    "knowledge_base_id" VARCHAR NOT NULL,
    "source_type" "KnowledgeBaseSourceType" NOT NULL,
    "source_id" VARCHAR NOT NULL,
    "chunk" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" VARCHAR NOT NULL,
    "embedding" vector(1024),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_knowledge_base_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wkb_workspace_status_deleted_idx" ON "workspace_knowledge_bases"("workspace_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "wkb_workspace_folder_node_idx" ON "workspace_knowledge_bases"("workspace_id", "folder_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "wkb_active_folder_key" ON "workspace_knowledge_bases"("workspace_id", "folder_node_id") WHERE "status" = 'active' AND "deleted_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "wkb_sources_kb_source_key" ON "workspace_knowledge_base_sources"("knowledge_base_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "wkb_sources_kb_included_status_idx" ON "workspace_knowledge_base_sources"("knowledge_base_id", "included", "status");

-- CreateIndex
CREATE INDEX "wkb_sources_workspace_source_idx" ON "workspace_knowledge_base_sources"("workspace_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "wkb_embeddings_kb_source_chunk_key" ON "workspace_knowledge_base_embeddings"("knowledge_base_id", "source_type", "source_id", "chunk");

-- CreateIndex
CREATE INDEX "wkb_embeddings_kb_source_idx" ON "workspace_knowledge_base_embeddings"("knowledge_base_id", "source_type", "source_id");

-- AddForeignKey
ALTER TABLE "workspace_knowledge_bases" ADD CONSTRAINT "workspace_knowledge_bases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_knowledge_base_sources" ADD CONSTRAINT "workspace_knowledge_base_sources_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_knowledge_base_sources" ADD CONSTRAINT "workspace_knowledge_base_sources_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "workspace_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_knowledge_base_embeddings" ADD CONSTRAINT "workspace_knowledge_base_embeddings_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "workspace_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
