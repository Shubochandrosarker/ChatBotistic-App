// Client for the WPISTIC AI worker that backs the in-dashboard help bubble.
//
// The worker (chat.wpistic.cloud, repo `llm-chat-app-template`) exposes
// POST /api/chat, which takes `{ messages, session_id }` and returns a
// Workers-AI SSE token stream. It is a separate origin, so this only
// works once the dashboard origin is on the worker's CORS allowlist —
// see `docs/support-bubble.md`. Until then every call fails preflight,
// which is why `streamSupportReply` reports a typed reason instead of a
// bare throw: the bubble falls back to static help links rather than
// showing users a broken chat.

/** Where the help bubble sends its messages. */
export const SUPPORT_CHAT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_CHAT_URL?.replace(/\/+$/, "") ||
  "https://chat.wpistic.cloud";

/** Set to "0" to hide the bubble entirely without a code change. */
export const SUPPORT_BUBBLE_ENABLED =
  process.env.NEXT_PUBLIC_SUPPORT_BUBBLE !== "0";

export interface SupportMessage {
  role: "user" | "assistant";
  content: string;
}

export type SupportFailure =
  /** Preflight/CORS rejected, worker unreachable, or the user is offline. */
  | "unreachable"
  /** Worker answered with a non-2xx (rate limit, 5xx, bad request). */
  | "rejected"
  /** The caller aborted — closing the panel mid-stream is not an error. */
  | "aborted";

export class SupportChatError extends Error {
  readonly reason: SupportFailure;
  constructor(reason: SupportFailure, message: string) {
    super(message);
    this.name = "SupportChatError";
    this.reason = reason;
  }
}

/**
 * Streams a reply, invoking `onToken` for each chunk as it arrives.
 *
 * Deliberately ignores the `x-wpistic-agent` response header. That header
 * drives the paid-agent offer card on the public site; inside the
 * dashboard the audience is people who have already bought, and pitching
 * them a paid agent while they are asking how to connect a phone number
 * is the wrong moment. Suppressing the card here is only half of it —
 * the worker can still mention an offer in prose, which needs the
 * support-mode change described in `docs/support-bubble.md`.
 */
export async function streamSupportReply(
  messages: SupportMessage[],
  sessionId: string,
  onToken: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${SUPPORT_CHAT_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, session_id: sessionId }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw new SupportChatError("aborted", "Cancelled.");
    throw new SupportChatError(
      "unreachable",
      err instanceof Error ? err.message : "Network request failed.",
    );
  }

  if (!response.ok || !response.body) {
    throw new SupportChatError(
      "rejected",
      `Assistant responded with ${response.status}.`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE frames are newline-delimited. Keep the trailing partial line
      // in the buffer — a token can straddle two network chunks, and
      // parsing half a JSON payload would drop it.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as { response?: string };
          if (parsed.response) onToken(parsed.response);
        } catch {
          // A frame that isn't JSON is not worth failing the stream over.
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) throw new SupportChatError("aborted", "Cancelled.");
    throw new SupportChatError(
      "unreachable",
      err instanceof Error ? err.message : "Stream interrupted.",
    );
  } finally {
    reader.releaseLock();
  }
}
