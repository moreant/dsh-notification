/**
 * Snapshot-store compatibility surface. Source builds against the split
 * 0.1.2 package; build.mjs rewrites that external to a runtime fallback that
 * uses client-runtime on 0.1.1.
 */
export { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
export type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
