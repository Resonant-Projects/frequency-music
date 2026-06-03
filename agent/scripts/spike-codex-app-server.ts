export {};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const baseUrl = requireEnv("CODEX_APP_SERVER_URL").replace(/\/$/, "");
const token = process.env.CODEX_APP_SERVER_AUTH_TOKEN;
const model = process.env.CODEX_APP_SERVER_MODEL ?? "codex-local";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};
if (token) headers.Authorization = `Bearer ${token}`;

const response = await fetch(`${baseUrl}/v1/chat/completions`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "user",
        content:
          "Reply with one short sentence confirming the Codex App Server chat endpoint is reachable.",
      },
    ],
    temperature: 0,
  }),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Codex App Server returned ${response.status}`);
  console.error(text.slice(0, 1000));
  process.exit(1);
}

const json = JSON.parse(text) as {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: unknown;
};

console.log(
  JSON.stringify(
    {
      ok: true,
      model: json.model ?? model,
      content: json.choices?.[0]?.message?.content ?? "",
      hasUsage: Boolean(json.usage),
    },
    null,
    2,
  ),
);
