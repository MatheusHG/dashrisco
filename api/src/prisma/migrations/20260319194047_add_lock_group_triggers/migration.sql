-- AlterTable
ALTER TABLE "lock_groups" ADD COLUMN     "trigger_filters" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "trigger_types" JSONB NOT NULL DEFAULT '["SPORT_BET","CASINO_BET"]';
