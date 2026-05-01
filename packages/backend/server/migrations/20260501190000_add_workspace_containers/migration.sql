-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('active', 'trashed');

-- CreateEnum
CREATE TYPE "ContainerFileKind" AS ENUM ('image', 'text', 'pdf');

-- CreateEnum
CREATE TYPE "ContainerFileStatus" AS ENUM ('pending', 'active', 'deleted');

-- CreateTable
CREATE TABLE "workspace_containers" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "status" "ContainerStatus" NOT NULL DEFAULT 'active',
    "created_by" VARCHAR NOT NULL,
    "updated_by" VARCHAR,
    "deleted_by" VARCHAR,
    "last_parent_folder_node_id" VARCHAR,
    "last_index" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "workspace_containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_container_files" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "container_id" VARCHAR NOT NULL,
    "blob_key" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "kind" "ContainerFileKind" NOT NULL,
    "mime" VARCHAR NOT NULL,
    "size" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "ContainerFileStatus" NOT NULL DEFAULT 'pending',
    "created_by" VARCHAR NOT NULL,
    "updated_by" VARCHAR,
    "deleted_by" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "workspace_container_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_containers_workspace_id_status_deleted_at_idx" ON "workspace_containers"("workspace_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "workspace_containers_workspace_id_name_idx" ON "workspace_containers"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "workspace_container_files_container_id_status_updated_at_idx" ON "workspace_container_files"("container_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "workspace_container_files_workspace_id_blob_key_idx" ON "workspace_container_files"("workspace_id", "blob_key");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_container_files_active_name_idx" ON "workspace_container_files"("container_id", lower("name")) WHERE "status" = 'active' AND "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "workspace_containers" ADD CONSTRAINT "workspace_containers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_container_files" ADD CONSTRAINT "workspace_container_files_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_container_files" ADD CONSTRAINT "workspace_container_files_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "workspace_containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
