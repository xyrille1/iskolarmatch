import "server-only";
import { getExtractionModel } from "@/lib/source-watcher/config";

// Thin wrapper around an OpenAI-compatible chat-completions endpoint, parallel
// to lib/email/ and lib/push/. Groq's free tier is the default provider for the
// source-watcher: the extraction call runs at $0/month at MVP scale. Because the
// deterministic change-gate skips the call entirely when nothing changed, idle
// weeks cost nothing.
//
// The provider is env-configurable so a free-tier swap is an env change, not a
// code edit (docs plan §2): set LLM_BASE_URL to any OpenAI-compatible endpoint
// and LLM_API_KEY to its key. Left unset, it stays on Groq via GROQ_API_KEY.
// Examples:
//   Groq (default): https://api.groq.com/openai/v1
//   Gemini:         https://generativelanguage.googleapis.com/v1beta/openai
//
// We call the endpoint with a plain fetch rather than a vendor SDK because the
// SDKs bake their own provider's path (e.g. groq-sdk always appends /openai/v1),
// which makes them unusable against a different base URL. The key is read only
// here, server-side (docs/SECURITY.md), and checked lazily (per call) -- so
// importing this module never throws at build time.

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

function getConfig(): { apiKey: string; baseURL: string } {
  const apiKey = process.env.LLM_API_KEY ?? process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY or GROQ_API_KEY must be set to run the source-watcher extraction.");
  }
  // Trailing slash trimmed so `${baseURL}/chat/completions` never double-slashes.
  const baseURL = (process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { apiKey, baseURL };
}

// OpenAI-compatible Structured Outputs JSON Schema wrapper (strict mode).
export interface GroqJsonSchema {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

export interface StructuredExtractionArgs {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: GroqJsonSchema;
}

// Shape of the (subset of the) OpenAI-compatible chat-completions response we read.
interface ChatResult {
  choices?: Array<{ message?: { content?: string | null } }>;
}

// Returns the raw JSON string from the model. The caller Zod-validates it --
// never trusted blindly even under strict mode, matching this repo's
// every-input-gets-validated convention (docs/ARCHITECTURE.md §8).
export async function runStructuredExtraction(args: StructuredExtractionArgs): Promise<string> {
  const { apiKey, baseURL } = getConfig();

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getExtractionModel(),
      // Deterministic: this is a batch extraction, not a creative task.
      temperature: 0,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: args.jsonSchema,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Extraction request failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const completion = (await response.json()) as ChatResult;
  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("The extraction provider returned an empty response.");
  }
  return content;
}
