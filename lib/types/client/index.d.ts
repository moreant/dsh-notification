/**
 * dsh-notification client plugin: the browser half of the completion
 * notification. Persists the notification preferences in a local snapshot
 * store, watches the session list for a running→idle edge (a live "a session
 * finished" signal), reads the host `notification` and `title` projections
 * for the turn's reason/text/tools, and — when permission and the
 * background-only gate pass — shows a desktop notification. Also registers the
 * settings section and the locale dictionaries. No harness allowlist is touched.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
/**
 * The desktop power service, when the shell provides one. Declared here rather
 * than imported so a stock web build type-checks without the desktop package;
 * the runtime check keeps the fallback to `beforeunload` for plain browsers.
 */
declare global {
    var crucible: {
        readonly power?: PowerFace;
    } | undefined;
}
/** The subset of `crucible.power` this plugin reads. */
interface PowerFace {
    on(event: 'beforeunload' | 'lock-screen' | 'suspend', listener: () => void): () => void;
}
/** Required services: the session list, slots, and locale. */
export declare const inject: string[];
/**
 * Compose the notification surface.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
export {};
