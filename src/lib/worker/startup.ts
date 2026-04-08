import { startWorker } from "./index";
import { runMigrations } from "@/lib/db/migrate";

let started = false;

export function ensureWorkerStarted(): void {
  if (started) return;
  started = true;
  // Run migrations then start worker
  runMigrations()
    .then(() => startWorker())
    .catch((err) => {
      console.error("[startup] Migration or worker start failed:", err);
      // Still try to start worker even if migration check failed
      startWorker();
    });
}
