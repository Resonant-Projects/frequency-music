import {
  decodeSignerBody,
  object,
  parseDecisionCallback,
  parseDecisionCode,
  readSignerBody,
  telegramId,
} from "./decisionSignerParsing";

const encode = (value: string) => new TextEncoder().encode(value);

async function equalSecret(actual: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encode(actual)),
    crypto.subtle.digest("SHA-256", encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}

export async function verifyTelegramSecrets(
  request: Request,
  config: {
    pathSecret: string;
    headerSecret: string;
  },
): Promise<boolean> {
  // Telegram secret_token alphabet; require nonempty separately provisioned secrets.
  if (
    ![config.pathSecret, config.headerSecret].every((value) =>
      /^[A-Za-z0-9_-]{1,256}$(?![\s\S])/.test(value),
    )
  )
    return false;
  const header = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  const path = new URL(request.url).pathname;
  if (header.length > 256 || path.length > 512) return false;
  const [pathMatches, headerMatches] = await Promise.all([
    equalSecret(path, `/telegram/webhook/${config.pathSecret}`),
    equalSecret(header, config.headerSecret),
  ]);
  return pathMatches && headerMatches;
}

export function parseTelegramDecision(value: unknown) {
  const update = object(value);
  if (
    typeof update?.update_id !== "number" ||
    !Number.isSafeInteger(update.update_id) ||
    update.update_id < 0
  )
    return null;
  const callback = object(update.callback_query);
  if (
    update.callback_query !== undefined &&
    (!callback || update.message !== undefined)
  )
    return null;
  const message = object(callback ? callback.message : update.message);
  const from = object(callback ? callback.from : message?.from);
  const signerId = telegramId(from?.id);
  const chatId = telegramId(object(message?.chat)?.id, true);
  const messageId = telegramId(message?.message_id);
  // Anonymous/channel senders and bots cannot stand in for a human sender.
  if (
    !signerId ||
    !chatId ||
    !messageId ||
    from?.is_bot !== false ||
    message?.sender_chat !== undefined
  )
    return null;
  const identity = {
    platform: "telegram" as const,
    signerId,
    chatId,
    eventId: String(update.update_id),
  };
  if (callback) {
    const parsed = parseDecisionCallback(callback.data);
    if (
      !parsed ||
      typeof callback.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$(?![\s\S])/.test(callback.id)
    )
      return null;
    return {
      kind: "callback" as const,
      ...identity,
      ...parsed,
      messageId,
      callbackQueryId: callback.id,
    };
  }
  const parsed = parseDecisionCode(message?.text);
  if (
    !parsed ||
    message?.forward_origin !== undefined ||
    message?.forward_from !== undefined
  )
    return null;
  return { kind: "code" as const, ...identity, ...parsed };
}

/** Internal lookup projection, not a decision-domain contract. Parent adapters
 * must recheck the binding and digest transactionally in canonical apply.
 */
type CodeCard = {
  intentId: string;
  payloadDigest: string;
  signerCard?: { platform: string; chatId: string; messageId: string };
};

type ParsedTelegram = NonNullable<ReturnType<typeof parseTelegramDecision>>;
function callbackApplyInput(
  event: Extract<ParsedTelegram, { kind: "callback" }>,
) {
  const { kind: _kind, callbackQueryId: _callbackQueryId, ...input } = event;
  return input;
}

export function createTelegramWebhookHandler(deps: {
  pathSecret: string;
  headerSecret: string;
  resolveCode: (code: string) => Promise<CodeCard | null>;
  // Adapter applies canonically, then sends/updates the human-facing result.
  apply: (event: ReturnType<typeof callbackApplyInput>) => Promise<void>;
  acknowledgeCallback: (callbackQueryId: string) => Promise<void>;
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    if (!(await verifyTelegramSecrets(request, deps)))
      return new Response("Unauthorized", { status: 401 });
    const bytes = await readSignerBody(request);
    const event = bytes && parseTelegramDecision(decodeSignerBody(bytes));
    // Authenticated updates that cannot become decisions are permanent rejects.
    // Acknowledge delivery so Telegram does not keep retrying /start, unrelated
    // messages, malformed callbacks, or an unavailable signer-card binding.
    if (!event) return Response.json({ ok: true });
    try {
      if (event.kind === "callback") {
        await deps.apply(callbackApplyInput(event));
        // Admission is durable. Callback UI acknowledgments must never make
        // Telegram retry the decision; the adapter owns bounded ACK retries.
        try {
          await deps.acknowledgeCallback(event.callbackQueryId);
        } catch {
          // Even ACK scheduling failure cannot undo committed admission.
        }
      } else {
        const card = await deps.resolveCode(event.code);
        const binding = card?.signerCard;
        if (
          !card ||
          binding?.platform !== "telegram" ||
          binding.chatId !== event.chatId ||
          !/^[1-9][0-9]*$(?![\s\S])/.test(binding.messageId) ||
          !/^[a-f0-9]{64}$(?![\s\S])/.test(card.payloadDigest)
        ) {
          return Response.json({ ok: true });
        }
        const parsed = parseDecisionCallback(
          event.verb === "confirm"
            ? `${card.intentId}:confirm:${card.payloadDigest.slice(0, 8)}`
            : `${card.intentId}:cancel`,
        );
        if (!parsed) return Response.json({ ok: true });
        await deps.apply({
          ...parsed,
          platform: event.platform,
          signerId: event.signerId,
          chatId: event.chatId,
          messageId: binding.messageId,
          eventId: event.eventId,
        });
      }
      return Response.json({ ok: true });
    } catch {
      return new Response("Temporarily unavailable", { status: 503 });
    }
  };
}
