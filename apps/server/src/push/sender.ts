// Sends one Web Push message (specs/game-server "Turn push delivery"). Behind an interface
// so tests use a fake; the real one wraps the `web-push` library with the VAPID keys.
import type { PushPayload } from "@hexfall/protocol";
import webpush from "web-push";
import type { PushConfig } from "../config.ts";
import type { StoredPushSub } from "./store.ts";

export interface PushMessage {
  sub: StoredPushSub;
  payload: PushPayload;
  /** Seconds the push service may hold the message for an offline device. */
  ttlSeconds: number;
  /** Collapses older undelivered messages with the same topic (the room code). */
  topic: string;
}

/** `gone`: the push service says the subscription no longer exists (404/410). */
export type SendOutcome = "sent" | "gone" | "failed";

export interface PushSender {
  send(msg: PushMessage): Promise<SendOutcome>;
}

export const PUSH_TIMEOUT_MS = 10_000;

export function createWebPushSender(
  cfg: PushConfig,
  log: (msg: string) => void = () => {},
): PushSender {
  const vapidDetails = {
    subject: cfg.subject,
    publicKey: cfg.publicKey,
    privateKey: cfg.privateKey,
  };
  return {
    async send({ sub, payload, ttlSeconds, topic }) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload),
          { vapidDetails, TTL: ttlSeconds, urgency: "high", topic, timeout: PUSH_TIMEOUT_MS },
        );
        return "sent";
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return "gone";
        log(`push to ${new URL(sub.endpoint).host} failed: ${status ?? String(err)}`);
        return "failed";
      }
    },
  };
}
