import { PrismaClient } from '@prisma/client';

export class AddDocContentType1764700000000 {
  static async up(db: PrismaClient) {
    await db.$executeRaw`
      ALTER TABLE "workspace_pages"
      ADD COLUMN IF NOT EXISTS "content_type" varchar NOT NULL DEFAULT 'document'
    `;

    await db.$executeRaw`
      UPDATE "workspace_pages"
      SET "content_type" = CASE
        WHEN "mode" = 1 THEN 'diagram'
        ELSE 'document'
      END
      WHERE "content_type" IS NULL OR "content_type" = 'document'
    `;

    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "workspace_pages_workspace_id_content_type_idx"
      ON "workspace_pages" ("workspace_id", "content_type")
    `;
  }

  static async down(db: PrismaClient) {
    await db.$executeRaw`
      DROP INDEX IF EXISTS "workspace_pages_workspace_id_content_type_idx"
    `;

    await db.$executeRaw`
      ALTER TABLE "workspace_pages"
      DROP COLUMN IF EXISTS "content_type"
    `;
  }
}
