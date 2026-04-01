-- CreateEnum
CREATE TYPE "AlertMode" AS ENUM ('ALERT', 'WATCH');

-- AlterTable
ALTER TABLE "alert_configs" ADD COLUMN "mode" "AlertMode" NOT NULL DEFAULT 'ALERT';

-- AlterTable
ALTER TABLE "panel_alerts" ADD COLUMN "mode" "AlertMode" NOT NULL DEFAULT 'ALERT';
