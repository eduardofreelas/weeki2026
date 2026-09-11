import { ContractError } from "./errors.js";
import type { ContractAiGenerationInput, ContractAiGenerationResult } from "../../shared/contracts.js";
import { sanitizeContractHtml } from "../../shared/contracts.js";

interface OpenAiResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

function outputText(response: OpenAiResponse) {
  if (response.output_text) return response.output_text;
  return response.output
    ?.flatMap((item) => item.content || [])
    .map((item) => item.text || "")
    .join("\n")
    .trim() || "";
}

function parseGeneration(value: string, model: string): ContractAiGenerationResult {
  try {
    const parsed = JSON.parse(value) as Partial<ContractAiGenerationResult>;
    if (!parsed.title || !parsed.content) throw new Error("missing fields");
    return {
      title: String(parsed.title).slice(0, 200),
      content: sanitizeContractHtml(String(parsed.content)),
      missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields.map(String).slice(0, 30) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).slice(0, 30) : [],
      model,
      provider: "openai",
    };
  } catch {
    throw new ContractError("CONTRACT_PROVIDER_UNAVAILABLE", 503, true);
  }
}

export class ContractAiClient {
  private readonly model = process.env.OPENAI_CONTRACTS_MODEL || "gpt-5";

  configured() {
    return Boolean(process.env.CONTRACTS_AI_ENABLED === "true" && process.env.OPENAI_API_KEY);
  }

  async generate(input: ContractAiGenerationInput): Promise<ContractAiGenerationResult> {
    if (!this.configured()) throw new ContractError("CONTRACT_AI_NOT_CONFIGURED", 503);
    const payload = {
      instructions: input.instructions,
      business: input.sourceSnapshot.business,
      client: input.sourceSnapshot.client ? {
        name: input.sourceSnapshot.client.name,
        kind: input.sourceSnapshot.client.kind,
        document: input.sourceSnapshot.client.document,
        email: input.sourceSnapshot.client.email,
        address: input.sourceSnapshot.client.address,
        representativeName: input.sourceSnapshot.client.representativeName,
      } : null,
      service: input.sourceSnapshot.service,
      billing: input.sourceSnapshot.billing ? {
        amount: input.sourceSnapshot.billing.amount,
        dueDate: input.sourceSnapshot.billing.dueDate,
        paymentMethods: input.sourceSnapshot.billing.paymentMethods,
      } : null,
      terms: input.terms,
      clauses: input.clauses,
    };
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "Você redige contratos profissionais em português do Brasil para prestadores de serviços.",
                  "Retorne exclusivamente JSON válido com title, content, missingFields e warnings.",
                  "O content deve ser HTML simples com h1, h2, p, ul, ol, li, strong, em e u.",
                  "Não invente documentos, datas, números, obrigações ou dados pessoais ausentes.",
                  "Marque claramente lacunas em missingFields e mantenha valores, prazos e condições consistentes.",
                  "Inclua o aviso de que o conteúdo exige revisão jurídica profissional somente como warning, não como cláusula.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(payload) }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "weeki_contract_generation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["title", "content", "missingFields", "warnings"],
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                missingFields: { type: "array", items: { type: "string" } },
                warnings: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (response.status === 401 || response.status === 403) throw new ContractError("CONTRACT_AI_NOT_CONFIGURED", 503);
    if (response.status === 429 || response.status >= 500) throw new ContractError("CONTRACT_PROVIDER_UNAVAILABLE", 503, true);
    if (!response.ok) throw new ContractError("CONTRACT_INVALID_INPUT", 422);
    return parseGeneration(outputText(await response.json() as OpenAiResponse), this.model);
  }
}
