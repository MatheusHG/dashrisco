-- CreateTable
CREATE TABLE "lock_group_events" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lock_group_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lock_group_events_group_id_idx" ON "lock_group_events"("group_id");

-- CreateIndex
CREATE INDEX "lock_group_events_created_at_idx" ON "lock_group_events"("created_at");

-- AddForeignKey
ALTER TABLE "lock_group_events" ADD CONSTRAINT "lock_group_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "lock_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
