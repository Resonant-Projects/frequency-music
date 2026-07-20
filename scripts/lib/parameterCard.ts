import { parameterKind, type CompositionParameter } from "./tuning";

export interface StarterKitProtocol {
  studyType: "litmus" | "comparison";
  durationSecs: number;
  panelPlanned: string[];
  listeningContext?: string;
  listeningMethod?: string;
  whatVaries: string[];
  whatStaysConstant: string[];
}

export interface StarterKitRecipe {
  _id: string;
  title: string;
  whyThisMatters?: string;
  parameters: CompositionParameter[];
  protocol?: StarterKitProtocol;
  dawChecklist: string[];
  hypothesis?: { question: string } | null;
}

export interface ParameterDisposition {
  index: number;
  honored: boolean;
  reason: string;
}

export interface ParameterCardInput {
  recipe: StarterKitRecipe;
  dispositions: ParameterDisposition[];
  degradationNotes: string[];
  manifest: string[];
}

function tableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ").trim();
}

function formatOptionalList(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join("; ") : "Not specified";
}

function formatOptionalText(value: string | undefined): string {
  return value?.trim() || "Not specified";
}

export function renderParameterCard(input: ParameterCardInput): string {
  const { recipe, manifest, degradationNotes } = input;
  const dispositionByIndex = new Map(
    input.dispositions.map((disposition) => [disposition.index, disposition]),
  );
  const protocol = recipe.protocol;
  const lines = [
    `# ${recipe.title}`,
    "",
    recipe.whyThisMatters ?? "Why this matters was not provided.",
    "",
    "## Hypothesis question",
    "",
    recipe.hypothesis?.question ?? "Hypothesis question unavailable.",
    "",
    "## Parameters",
    "",
    "| Kind | Value | Honored in kit | Reason |",
    "| --- | --- | --- | --- |",
  ];

  for (const [index, parameter] of recipe.parameters.entries()) {
    const disposition = dispositionByIndex.get(index) ?? {
      honored: false,
      reason: "No starter-kit generator supports this parameter kind.",
    };
    lines.push(
      `| ${tableCell(parameterKind(parameter))} | ${tableCell(parameter.value)} | ${disposition.honored ? "✓" : "—"} | ${tableCell(disposition.reason)} |`,
    );
  }

  lines.push(
    "",
    "## Protocol",
    "",
    `- Study type: ${protocol?.studyType ?? "Not specified"}`,
    `- Panel planned: ${formatOptionalList(protocol?.panelPlanned)}`,
    `- Listening context: ${formatOptionalText(protocol?.listeningContext)}`,
    `- Listening method: ${formatOptionalText(protocol?.listeningMethod)}`,
    `- What varies: ${formatOptionalList(protocol?.whatVaries)}`,
    `- What stays constant: ${formatOptionalList(protocol?.whatStaysConstant)}`,
    `- Duration: ${protocol ? `${protocol.durationSecs} seconds` : "Not specified"}`,
    "",
    "## DAW checklist",
    "",
    ...(recipe.dawChecklist.length > 0
      ? recipe.dawChecklist.map((item) => `- ${item}`)
      : ["- No DAW checklist was provided."]),
    "",
    "## Kit manifest",
    "",
    ...manifest.map((filename) => `- \`${filename}\``),
    "",
    "## Degradation notes",
    "",
    ...(degradationNotes.length > 0
      ? degradationNotes.map((note) => `- ${note}`)
      : ["- None."]),
    "",
  );

  return lines.join("\n");
}
