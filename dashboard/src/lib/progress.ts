/**
 * In-memory progress tracking for running audits.
 * Simple approach that works for single-server deployment.
 */
export const progressMap = new Map<number, {
  step: string;
  detail: string;
  timestamp: number;
}>();
