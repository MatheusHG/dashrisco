-- AddForeignKey
ALTER TABLE "panel_tasks" ADD CONSTRAINT "panel_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
