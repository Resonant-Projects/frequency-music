import { withSignerDeadline } from "./decisionSignerTransport";
import {
  decodeSignerBody,
  discordId,
  object,
  parseDecisionCallback,
  readSignerBody,
} from "./decisionSignerParsing";

function hexBytes(
  value: string,
  length: number,
): Uint8Array<ArrayBuffer> | null {
  if (
    value.length !== length * 2 ||
    !new RegExp(`^[a-fA-F0-9]{${length * 2}}$`).test(value)
  )
    return null;
  return Uint8Array.from(value.match(/../g)!, (byte) =>
    Number.parseInt(byte, 16),
  );
}

export async function verifyDiscordSignature(input: {
  publicKey: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: Uint8Array;
  now: number;
}): Promise<boolean> {
  const { publicKey, signature, timestamp, rawBody, now } = input;
  if (
    !timestamp ||
    !/^[0-9]{1,12}$(?![\s\S])/.test(timestamp) ||
    !Number.isFinite(now)
  )
    return false;
  const age = now - Number(timestamp) * 1000;
  if (age < 0 || age > 300_000) return false;
  const keyBytes = hexBytes(publicKey, 32);
  const signatureBytes = hexBytes(signature ?? "", 64);
  if (!keyBytes || !signatureBytes) return false;
  const prefix = new TextEncoder().encode(timestamp);
  const signed = new Uint8Array(prefix.length + rawBody.length);
  signed.set(prefix);
  signed.set(rawBody, prefix.length);
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      "Ed25519",
      false,
      ["verify"],
    );
    return await crypto.subtle.verify("Ed25519", key, signatureBytes, signed);
  } catch {
    return false;
  }
}

export function parseDiscordDecision(value: unknown) {
  const event = object(value);
  if (event?.type !== 3) return null;
  const data = object(event.data);
  if (data?.component_type !== 2) return null;
  const callback = parseDecisionCallback(data.custom_id);
  const user = object(object(event.member)?.user);
  const signerId = discordId(user?.id);
  const chatId = discordId(event.channel_id);
  const messageId = discordId(object(event.message)?.id);
  const eventId = discordId(event.id);
  // Guild signer cards use member.user, never a top-level caller-supplied user.
  if (
    !callback ||
    !signerId ||
    !chatId ||
    !messageId ||
    !eventId ||
    user?.bot === true
  )
    return null;
  return {
    ...callback,
    platform: "discord" as const,
    signerId,
    chatId,
    messageId,
    eventId,
  };
}

/** No route is registered here. The caller must await durable enqueue before ACK.
 * The queued internal worker performs canonical apply and edits the signer card.
 * Enqueue must audit/reject unmapped signers and deduplicate by interaction id.
 * Canonical apply must repeat all authorization checks in its transaction.
 */
export function createDiscordInteractionHandler(deps: {
  publicKey: string;
  applicationId: string;
  now: () => number;
  enqueue: (
    event: NonNullable<ReturnType<typeof parseDiscordDecision>>,
  ) => Promise<"queued" | "signers_only">;
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    const rawBody = await readSignerBody(request);
    if (!rawBody) return new Response("Invalid request", { status: 400 });
    const valid = await verifyDiscordSignature({
      publicKey: deps.publicKey,
      signature: request.headers.get("X-Signature-Ed25519"),
      timestamp: request.headers.get("X-Signature-Timestamp"),
      rawBody,
      now: deps.now(),
    });
    if (!valid) return new Response("Unauthorized", { status: 401 });
    const payload = object(decodeSignerBody(rawBody));
    if (
      !discordId(deps.applicationId) ||
      payload?.application_id !== deps.applicationId
    ) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (payload.type === 1) return Response.json({ type: 1 });
    const event = parseDiscordDecision(payload);
    if (!event) return new Response("Invalid interaction", { status: 400 });
    try {
      const admission = await withSignerDeadline(
        () => deps.enqueue(event),
        2_000,
      );
      return Response.json({
        type: 4,
        data: {
          content:
            admission === "signers_only"
              ? "Signers only."
              : "Confirmation received. Check the signer card for the result.",
          flags: 64,
          allowed_mentions: { parse: [] },
        },
      });
    } catch {
      return new Response("Temporarily unavailable", { status: 503 });
    }
  };
}
