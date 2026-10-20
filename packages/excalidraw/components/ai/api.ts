/**
 * The client for the user's own provider.
 *
 * Every request goes from the user's browser straight to the base url they
 * configured. There is no Mosaic server in the middle, and there is no
 * bundled key: the only credential that travels is the user's own, and it
 * travels only to the endpoint they set.
 *
 * The provider is expected to speak the OpenAI chat completions API, which
 * is what most of them do (OpenAI, OpenRouter, Groq, Together, Ollama, LM
 * Studio, vLLM, ...).
 */

import { normalizeBaseUrl } from "./storage";

import type { AIChatMessage, AISettings } from "./types";

/**
 * A failure the user can act on.
 *
 * The message is written for the person looking at the panel, not for a log:
 * it says what went wrong and, where that is knowable, what to change.
 */
export class AIApiError extends Error {
  /** the http status, when the request got as far as the provider */
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AIApiError";
    this.status = status;
  }
}

/** the chat completions url for a base url */
export const buildChatCompletionsUrl = (baseUrl: string): string =>
  `${normalizeBaseUrl(baseUrl)}/chat/completions`;

/** the host of a url, for telling the user where a request went */
const getHost = (url: string): string => {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
};

/**
 * The provider's own words about what went wrong, when it gave any.
 *
 * Only the short, plain ones are read: provider error bodies are often
 * html, and a wall of html in the panel helps nobody.
 */
const readProviderMessage = (body: string): string => {
  try {
    const parsed = JSON.parse(body);
    const error = parsed?.error;

    if (typeof error === "string") {
      return error.slice(0, 200);
    }
    if (typeof error?.message === "string") {
      return error.message.slice(0, 200);
    }
  } catch {
    // not json - the body is not worth showing
  }

  return body && body.length <= 200 && !body.includes("<") ? body : "";
};

/**
 * What to say about a failed request.
 *
 * The status is the interesting part: 401 means the key is wrong, 404 means
 * the url is wrong, and everything else is the provider's side. Whatever the
 * provider said about it is added at the end, when it said anything.
 */
const describeFailure = (status: number, body: string): string => {
  const reason = readProviderMessage(body);
  const detail = reason ? ` (${reason})` : "";

  switch (status) {
    case 400:
      return `The provider rejected the request (400). Check the model name and the base URL.${detail}`;
    case 401:
    case 403:
      return `The provider rejected the API key (${status}). Check the key in Settings.${detail}`;
    case 404:
      return `No chat completions endpoint at that URL (404). Check the base URL.${detail}`;
    case 413:
      return `The request was too large (413). Try a shorter prompt.${detail}`;
    case 429:
      return `The provider is rate limiting this key (429). Wait a moment and try again.${detail}`;
    default:
      break;
  }

  if (status >= 500) {
    return `The provider failed (${status}). Try again in a moment.${detail}`;
  }

  return `The request failed (${status}).${detail}`;
};

/**
 * The text of a message, whatever shape the provider gave it.
 *
 * Most providers answer with a plain string, but some answer with a list of
 * content parts. Both are read; anything else is treated as no answer.
 */
const readContent = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("");
  }

  return "";
};

/** the answer of a plain (not streamed) chat completions response */
const readAnswer = (payload: any): string => {
  const choice = payload?.choices?.[0];
  if (!choice) {
    return "";
  }

  const message = choice.message ?? choice.delta;
  if (!message) {
    return "";
  }

  return readContent(message.content);
};

/**
 * The answer of a streamed chat completions response.
 *
 * The panel asks for a plain response, but a provider may stream anyway, so
 * the server-sent events are read and their deltas joined. Each event is a
 * `data:` line holding a chunk of json.
 */
const readStreamedAnswer = (body: string): string => {
  let answer = "";
  const lines = body.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }

    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") {
      continue;
    }

    try {
      answer += readAnswer(JSON.parse(data));
    } catch {
      // a chunk that is not json is not worth losing the rest of the
      // answer over
    }
  }

  return answer;
};

/**
 * Asks the user's provider for an answer.
 *
 * @returns the model's answer, as plain text
 * @throws an {@link AIApiError} the panel can show to the user
 */
export const sendChatCompletion = async ({
  settings,
  messages,
  signal,
}: {
  settings: AISettings;
  messages: AIChatMessage[];
  signal?: AbortSignal;
}): Promise<string> => {
  const url = buildChatCompletionsUrl(settings.baseUrl);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        stream: false,
      }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new AIApiError(
      `Could not reach ${getHost(
        url,
      )}. Check the base URL and your connection.`,
    );
  }

  const body = await response.text();

  if (!response.ok) {
    throw new AIApiError(
      describeFailure(response.status, body),
      response.status,
    );
  }

  const contentType = response.headers?.get?.("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    return readStreamedAnswer(body);
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new AIApiError(
      "The provider answered with something that is not JSON. Check the base URL - it may not be a chat completions endpoint.",
    );
  }

  const answer = readAnswer(payload);

  if (!answer) {
    throw new AIApiError("The provider answered with an empty message.");
  }

  return answer;
};
