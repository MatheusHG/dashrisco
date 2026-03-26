-- AlterTable
ALTER TABLE "panel_tasks" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "completed_by" TEXT;

-- CreateIndex
CREATE INDEX "panel_tasks_completed_by_idx" ON "panel_tasks"("completed_by");
