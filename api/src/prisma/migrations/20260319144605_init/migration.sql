-- CreateEnum
CREATE TYPE "WebhookType" AS ENUM ('CASINO_BET', 'CASINO_PRIZE', 'SPORT_BET', 'SPORT_PRIZE', 'LOGIN', 'DEPOSIT', 'WITHDRAWAL_CONFIRMATION');

-- CreateEnum
CREATE TYPE "Operator" AS ENUM ('EQUAL', 'GREATER', 'LESS');

-- CreateEnum
CREATE TYPE "LogicGate" AS ENUM ('AND', 'OR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "webhook_type" "WebhookType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "publish_panel" BOOLEAN NOT NULL DEFAULT false,
    "publish_chat" BOOLEAN NOT NULL DEFAULT false,
    "chat_webhook_url" TEXT,
    "create_panel_task" BOOLEAN NOT NULL DEFAULT false,
    "create_clickup_task" BOOLEAN NOT NULL DEFAULT false,
    "clickup_list_id" TEXT,
    "selected_fields" JSONB NOT NULL,

    CONSTRAINT "alert_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_filters" (
    "id" TEXT NOT NULL,
    "alert_config_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" "Operator" NOT NULL,
    "value" TEXT NOT NULL,
    "logic_gate" "LogicGate",
    "order" INTEGER NOT NULL,

    CONSTRAINT "alert_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_alerts" (
    "id" TEXT NOT NULL,
    "alert_config_id" TEXT NOT NULL,
    "webhook_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panel_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_tasks" (
    "id" TEXT NOT NULL,
    "alert_config_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "data" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "panel_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lock_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lock_seconds" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lock_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lock_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "ngx_user_id" TEXT NOT NULL,
    "ngx_username" TEXT,
    "ngx_name" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lock_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RolePermissions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RolePermissions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_key" ON "permissions"("action");

-- CreateIndex
CREATE INDEX "logs_created_at_idx" ON "logs"("created_at");

-- CreateIndex
CREATE INDEX "logs_user_id_idx" ON "logs"("user_id");

-- CreateIndex
CREATE INDEX "logs_action_idx" ON "logs"("action");

-- CreateIndex
CREATE INDEX "alert_configs_webhook_type_idx" ON "alert_configs"("webhook_type");

-- CreateIndex
CREATE INDEX "alert_configs_active_idx" ON "alert_configs"("active");

-- CreateIndex
CREATE INDEX "panel_alerts_created_at_idx" ON "panel_alerts"("created_at");

-- CreateIndex
CREATE INDEX "panel_alerts_alert_config_id_idx" ON "panel_alerts"("alert_config_id");

-- CreateIndex
CREATE INDEX "panel_tasks_status_idx" ON "panel_tasks"("status");

-- CreateIndex
CREATE INDEX "panel_tasks_created_at_idx" ON "panel_tasks"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "lock_group_members_group_id_ngx_user_id_key" ON "lock_group_members"("group_id", "ngx_user_id");

-- CreateIndex
CREATE INDEX "_RolePermissions_B_index" ON "_RolePermissions"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_filters" ADD CONSTRAINT "alert_filters_alert_config_id_fkey" FOREIGN KEY ("alert_config_id") REFERENCES "alert_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_alerts" ADD CONSTRAINT "panel_alerts_alert_config_id_fkey" FOREIGN KEY ("alert_config_id") REFERENCES "alert_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lock_group_members" ADD CONSTRAINT "lock_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "lock_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
