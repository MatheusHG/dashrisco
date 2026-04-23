-- AddColumn
ALTER TABLE "alert_configs" ADD COLUMN "early_payout_providers" JSONB NOT NULL DEFAULT '["NGX"]';
