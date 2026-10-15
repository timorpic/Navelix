import { db } from "../db.ts";
/** SAVEPOINT composes with existing domain transactions and rolls audit and writes back together. */
export function auditedTransaction<T>(task: () => T): T {
  db.exec("SAVEPOINT logged_operation");
  try { const result = task(); db.exec("RELEASE logged_operation"); return result; }
  catch (error) { db.exec("ROLLBACK TO logged_operation; RELEASE logged_operation"); throw error; }
}
