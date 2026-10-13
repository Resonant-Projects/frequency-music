import { withSignerDeadline } from "./decisionSignerTransport";
import {
  discordId,
  object,
  parseDecisionCallback,
  parseDecisionCode,
  telegramId,
} from "./decisionSignerParsing";

/** A display projection supplied by the canonical intent module. It must include
 * the exact payload summary (including absent listening ratings), not raw JSON.
 * Overlong cards fail closed instead of silently hiding decision content.
 */
export type SignerCardDisplay = {
  intentId: string;
  code: string;
  actionLabel: string;
  targetTitle: string;
  note: string;
  payloadSummary: string;
  payloadDigest: string;
};

type Destination = { platform: "discord" | "telegram"; chatId: string };
type Binding = Destination & { messageId: string };

function safeText(value: string, limit: number): boolean {
  if (value.length > limit) return false;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (
      code < 9 ||
      (code > 10 && code < 32) ||
      code === 127 ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    )
      return false;
  }
  return true;
}

function discordText(value: string): string {
  return value
    .replaceAll(/([\\`*_{}[\]()<>~|#])/g, "\\$1")
    .replaceAll("@", "@\u200b");
}

export function renderSignerCard(
  platform: Destination["platform"],
  card: SignerCardDisplay,
) {
  const confirm = `${card.intentId}:confirm:${card.payloadDigest.slice(0, 8)}`;
  const cancel = `${card.intentId}:cancel`;
  if (
    !parseDecisionCallback(confirm) ||
    !parseDecisionCallback(cancel) ||
    !parseDecisionCode(`confirm ${card.code}`) ||
    !/^[a-f0-9]{64}$(?![\s\S])/.test(card.payloadDigest) ||
    !/^[A-Za-z][A-Za-z ]{0,49}$(?![\s\S])/.test(card.actionLabel) ||
    !card.targetTitle.trim() ||
    !safeText(card.targetTitle, 200) ||
    !safeText(card.note, 400) ||
    !card.payloadSummary.trim() ||
    !safeText(card.payloadSummary, 700)
  ) {
    throw new Error("Invalid signer card display");
  }
  const text = `${card.code}: ${card.actionLabel}\n${card.targetTitle}\n\nNote: ${card.note || "Not given"}\n${card.payloadSummary}\n\nDigest: ${card.payloadDigest.slice(0, 8)}`;
  if (platform === "discord") {
    const content = discordText(text);
    if (content.length > 2000) throw new Error("Signer card too long");
    return {
      platform,
      payload: {
        content,
        allowed_mentions: { parse: [] },
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                label: `Confirm ${card.actionLabel}`,
                custom_id: confirm,
              },
              { type: 2, style: 2, label: "Cancel", custom_id: cancel },
            ],
          },
        ],
      },
    };
  }
  if (text.length > 4096) throw new Error("Signer card too long");
  return {
    platform,
    payload: {
      text,
      link_preview_options: { is_disabled: true },
      reply_markup: {
        inline_keyboard: [
          [
            { text: `Confirm ${card.actionLabel}`, callback_data: confirm },
            { text: "Cancel", callback_data: cancel },
          ],
        ],
      },
    },
  };
}

function validDestination(destination: Destination): boolean {
  return destination.platform === "discord"
    ? discordId(destination.chatId) !== null
    : /^-?[1-9][0-9]*$(?![\s\S])/.test(destination.chatId) &&
        telegramId(Number(destination.chatId), true) === destination.chatId;
}

function postedBinding(
  destination: Destination,
  response: unknown,
): Binding | null {
  const body = object(response);
  if (destination.platform === "discord") {
    const messageId = discordId(body?.id);
    return messageId && body?.channel_id === destination.chatId
      ? { ...destination, messageId }
      : null;
  }
  const message = object(body?.result);
  const messageId = telegramId(message?.message_id);
  return body?.ok === true &&
    messageId &&
    telegramId(object(message?.chat)?.id, true) === destination.chatId
    ? { ...destination, messageId }
    : null;
}

/** Transport adapters own credentials, fixed platform endpoints, response-byte
 * limits and honor the abort signal. They throw on HTTP errors and return decoded JSON.
 * Never automatically retry a post: an ambiguous failure may have sent a card.
 */
export async function postSignerCard(input: {
  destination: Destination;
  card: SignerCardDisplay;
  post: (
    destination: Destination,
    card: ReturnType<typeof renderSignerCard>,
    signal: AbortSignal,
  ) => Promise<unknown>;
  persistBinding: (intentId: string, binding: Binding) => Promise<void>;
}) {
  let rendered: ReturnType<typeof renderSignerCard>;
  try {
    if (!validDestination(input.destination))
      return { status: "invalid_card" as const };
    rendered = renderSignerCard(input.destination.platform, input.card);
  } catch {
    return { status: "invalid_card" as const };
  }
  let response: unknown;
  try {
    response = await withSignerDeadline((signal) =>
      input.post(input.destination, rendered, signal),
    );
  } catch {
    return { status: "post_unconfirmed" as const };
  }
  const binding = postedBinding(input.destination, response);
  if (!binding) return { status: "post_unconfirmed" as const };
  try {
    // Must atomically reject rebinding and terminal/expired intents.
    await withSignerDeadline(() =>
      input.persistBinding(input.card.intentId, binding),
    );
    return { status: "posted" as const, binding };
  } catch {
    // Retain the real binding for reconciliation; do not post again.
    return { status: "binding_unconfirmed" as const, binding };
  }
}

const resultText = {
  applied: "Decision applied.",
  cancelled: "Decision cancelled.",
  expired: "Decision expired. Propose a new decision.",
  rejected: "Decision rejected. Review it on Frequency.",
  signersOnly: "Signers only.",
} as const;

/** Only the canonical backend result adapter chooses this display result.
 * Do not pass backend errors, payloads, transcripts or transport bodies through.
 */
export async function updateSignerCard(input: {
  binding: Binding;
  result: keyof typeof resultText;
  edit: (
    binding: Binding,
    payload: ReturnType<typeof renderSignerResult>,
    signal: AbortSignal,
  ) => Promise<void>;
}) {
  try {
    if (
      !validDestination(input.binding) ||
      !/^[1-9][0-9]{0,19}$(?![\s\S])/.test(input.binding.messageId)
    )
      return { status: "update_failed" as const };
    const rendered = renderSignerResult(input.binding.platform, input.result);
    await withSignerDeadline((signal) =>
      input.edit(input.binding, rendered, signal),
    );
    return { status: "updated" as const };
  } catch {
    return { status: "update_failed" as const };
  }
}

export function renderSignerResult(
  platform: Destination["platform"],
  result: keyof typeof resultText,
) {
  const text = resultText[result];
  if (!text) throw new Error("Invalid signer result");
  // Unknown signers must not disable the valid signer's card.
  if (result === "signersOnly")
    throw new Error("Use a private signer rejection reply");
  return platform === "discord"
    ? {
        platform,
        payload: {
          content: text,
          allowed_mentions: { parse: [] },
          components: [],
        },
      }
    : { platform, payload: { text, reply_markup: { inline_keyboard: [] } } };
}
