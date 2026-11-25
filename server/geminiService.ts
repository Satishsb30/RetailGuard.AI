import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { AuditResult, GeminiAuditBrief } from '../src/types/audit.ts';

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

export class GeminiServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'GeminiServiceError';
    this.statusCode = statusCode;
  }
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiServiceError(
      'GEMINI_API_KEY is not configured. Please add a valid Gemini API key in Settings > Secrets.',
      400
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ParsedSdkError {
  statusCode: number;
  statusText: string;
  message: string;
  isTransient: boolean;
}

function parseGeminiSdkError(err: unknown): ParsedSdkError {
  const rawMessage = err instanceof Error ? err.message : String(err);
  let statusCode = 500;
  let statusText = '';
  let cleanMessage = rawMessage;

  const statusFromErr = (err as { status?: number })?.status;
  if (typeof statusFromErr === 'number' && statusFromErr >= 400) {
    statusCode = statusFromErr;
  }

  try {
    const jsonStart = rawMessage.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(rawMessage.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed.error) {
        if (typeof parsed.error.code === 'number') {
          statusCode = parsed.error.code;
        }
        if (parsed.error.status) {
          statusText = parsed.error.status;
        }
        if (parsed.error.message) {
          cleanMessage = parsed.error.message;
        }
      }
    }
  } catch {
    // Keep rawMessage when not JSON
  }

  const upper = `${statusText} ${cleanMessage}`.toUpperCase();
  const isAuthError =
    statusCode === 401 ||
    statusCode === 403 ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('API KEY NOT VALID');

  if (isAuthError) {
    return {
      statusCode: 400,
      statusText: statusText || 'INVALID_API_KEY',
      message:
        'Your Gemini API key was rejected or lacks permission. Please verify GEMINI_API_KEY in Settings > Secrets.',
      isTransient: false,
    };
  }

  const isTransient =
    statusCode === 503 ||
    statusCode === 429 ||
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 504 ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('ETIMEDOUT') ||
    upper.includes('ECONNRESET');

  if (statusCode === 503 || upper.includes('UNAVAILABLE')) {
    return {
      statusCode: 503,
      statusText: statusText || 'UNAVAILABLE',
      message: `${cleanMessage} Both primary and fallback Gemini models are temporarily busy—please retry in a moment.`,
      isTransient: true,
    };
  }

  return {
    statusCode,
    statusText,
    message: cleanMessage,
    isTransient,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  contents: string,
  config: {
    systemInstruction?: string;
    responseMimeType: string;
    responseSchema: Record<string, unknown>;
  }
): Promise<{ text: string; modelUsed: string }> {
  const attempts: { model: string; thinkingLevel: ThinkingLevel; delayMs: number }[] = [
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.LOW, delayMs: 0 },
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.LOW, delayMs: 650 },
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.LOW, delayMs: 1400 },
    { model: FALLBACK_MODEL, thinkingLevel: ThinkingLevel.MINIMAL, delayMs: 300 },
    { model: FALLBACK_MODEL, thinkingLevel: ThinkingLevel.MINIMAL, delayMs: 1100 },
  ];

  let lastParsedError: ParsedSdkError | null = null;

  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      const jitter = Math.floor(Math.random() * 250);
      await sleep(attempt.delayMs + jitter);
    }

    try {
      const response = await ai.models.generateContent({
        model: attempt.model,
        contents,
        config: {
          ...config,
          thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
        },
      });

      const text = (response.text ?? '').trim();
      if (!text) {
        throw new Error(`Model ${attempt.model} returned an empty response.`);
      }
      return { text, modelUsed: attempt.model };
    } catch (err) {
      const parsed = parseGeminiSdkError(err);
      lastParsedError = parsed;
      if (!parsed.isTransient) {
        throw new GeminiServiceError(parsed.message, parsed.statusCode);
      }
    }
  }

  throw new GeminiServiceError(
    lastParsedError?.message ??
      'Gemini API is temporarily unavailable due to high demand. Please try again shortly.',
    lastParsedError?.statusCode ?? 503
  );
}

export async function generateAuditBriefWithGemini(
  audit: AuditResult
): Promise<GeminiAuditBrief> {
  const ai = getAiClient();

  if (audit.findings.length === 0) {
    const cleanPrompt = `You are RetailGuard AI, a helpful retail data quality assistant for store managers and finance analysts.
The uploaded retail CSV "${audit.fileName}" (${audit.summary.totalDataRows} transaction rows) passed all format, arithmetic, duplicate, date, and statistical quantity checks with 0 flagged issues.
Write a clear, concise 2-sentence executive summary confirming the file is ready for sales reporting, and 2 practical verification takeaways.`;

    const { text, modelUsed } = await generateWithRetryAndFallback(ai, cleanPrompt, {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          executiveSummary: { type: Type.STRING },
          keyTakeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['executiveSummary', 'keyTakeaways'],
      },
    });

    const parsed = JSON.parse(text) as {
      executiveSummary?: string;
      keyTakeaways?: string[];
    };

    return {
      generatedAt: new Date().toISOString(),
      model: modelUsed,
      executiveSummary:
        parsed.executiveSummary ??
        'All transaction rows passed validation with no data quality issues detected.',
      keyTakeaways: parsed.keyTakeaways ?? [],
      findingExplanations: [],
    };
  }

  const findingsForPrompt = audit.findings.slice(0, 40).map((f) => ({
    findingId: f.id,
    issueName: f.issueName,
    priority: f.priority,
    columnName: f.columnName,
    sourceRow: f.sourceRow,
    transactionId: f.transactionId ?? 'N/A',
    cellValue: f.cellValue,
    evidence: f.evidence,
  }));

  const prompt = `You are RetailGuard AI, a senior retail operations and data quality assistant.
Your audience is store managers and retail finance analysts who want simple, clear, jargon-free English explanations.

IMPORTANT PRINCIPLES:
- Original CSV records are NEVER modified or deleted automatically.
- Unusually large quantities (Statistical Anomaly / Unusual Bulk Quantity) may be valid wholesale or bulk orders — always remind the reviewer to verify against invoices or supervisor approval rather than deleting.
- Reference exact source row numbers and transaction IDs where helpful.

Dataset Context:
- File: ${audit.fileName}
- Total transaction rows: ${audit.summary.totalDataRows}
- High priority findings: ${audit.summary.highPriorityCount}
- Medium priority findings: ${audit.summary.mediumPriorityCount}
- Quantity stats: ${audit.summary.quantityStats ? `median=${audit.summary.quantityStats.median}, IQR upper fence=${audit.summary.quantityStats.upperFence}` : 'N/A'}

Flagged Findings:
${JSON.stringify(findingsForPrompt, null, 2)}

Provide:
1. executiveSummary: 2-3 plain-language sentences summarizing the overall health of this export and what needs attention first.
2. keyTakeaways: 3 concise bullet-style takeaways for the review team.
3. findingExplanations: For EVERY findingId in the input list, provide:
   - findingId (must match exact ID)
   - plainExplanation: 1-2 simple sentences explaining why this matters in retail reporting (no technical jargon).
   - recommendedAction: 1 concrete manual verification step the reviewer should take.`;

  const { text, modelUsed } = await generateWithRetryAndFallback(ai, prompt, {
    systemInstruction:
      'Respond strictly in valid JSON matching the requested schema. Keep explanations concise, clear, and practical for retail operations.',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        executiveSummary: { type: Type.STRING },
        keyTakeaways: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        findingExplanations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              findingId: { type: Type.STRING },
              plainExplanation: { type: Type.STRING },
              recommendedAction: { type: Type.STRING },
            },
            required: ['findingId', 'plainExplanation', 'recommendedAction'],
          },
        },
      },
      required: ['executiveSummary', 'keyTakeaways', 'findingExplanations'],
    },
  });

  const parsed = JSON.parse(text) as {
    executiveSummary: string;
    keyTakeaways: string[];
    findingExplanations: {
      findingId: string;
      plainExplanation: string;
      recommendedAction: string;
    }[];
  };

  return {
    generatedAt: new Date().toISOString(),
    model: modelUsed,
    executiveSummary: parsed.executiveSummary,
    keyTakeaways: parsed.keyTakeaways ?? [],
    findingExplanations: parsed.findingExplanations ?? [],
  };
}
