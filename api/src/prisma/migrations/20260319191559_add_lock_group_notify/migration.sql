-- AlterTable
ALTER TABLE "lock_groups" ADD COLUMN     "chat_webhook_url" TEXT,
ADD COLUMN     "notify_chat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notify_panel" BOOLEAN NOT NULL DEFAULT false;
