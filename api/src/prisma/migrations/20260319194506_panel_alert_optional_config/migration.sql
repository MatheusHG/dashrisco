-- DropForeignKey
ALTER TABLE "panel_alerts" DROP CONSTRAINT "panel_alerts_alert_config_id_fkey";

-- AlterTable
ALTER TABLE "panel_alerts" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'alert',
ALTER COLUMN "alert_config_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "panel_alerts_source_idx" ON "panel_alerts"("source");

-- AddForeignKey
ALTER TABLE "panel_alerts" ADD CONSTRAINT "panel_alerts_alert_config_id_fkey" FOREIGN KEY ("alert_config_id") REFERENCES "alert_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
