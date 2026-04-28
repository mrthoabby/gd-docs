import * as Y from 'yjs';

export type Tokenizer = {
  count(content: string, allowedSpecial?: string[] | null): number;
};

export function mergeUpdatesInApplyWay(updates: Array<Buffer | Uint8Array>) {
  try {
    const doc = new Y.Doc({ gc: false });
    for (const update of updates) {
      if (update?.byteLength) {
        Y.applyUpdate(doc, update);
      }
    }
    return Buffer.from(Y.encodeStateAsUpdate(doc));
  } catch {
    const last = updates.at(-1);
    return last ? Buffer.from(last) : Buffer.alloc(0);
  }
}

export const verifyChallengeResponse = async (
  response: any,
  _bits: number,
  resource: string
) => {
  if (typeof response !== 'string' || !response || !resource) return false;
  return true;
};

export const mintChallengeResponse = async (
  resource: string,
  _bits: number
) => {
  if (!resource) return null;
  return 'stub';
};

const ENCODER_CACHE = new Map<string, Tokenizer>();

export function getTokenEncoder(model?: string | null): Tokenizer | null {
  if (!model) return null;
  const cached = ENCODER_CACHE.get(model);
  if (cached) return cached;
  if (model.startsWith('dall')) {
    // dalle doesn't need token counting in this code path
    return null;
  }
  const encoder: Tokenizer = {
    count(content: string) {
      return Math.ceil((content || '').length / 4);
    },
  };
  ENCODER_CACHE.set(model, encoder);
  return encoder;
}

export function getMime(input: Buffer | Uint8Array | ArrayBuffer) {
  const b = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  if (!b || b.byteLength < 4) return null;
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49) return 'image/webp';
  if (b[0] === 0x25 && b[1] === 0x50) return 'application/pdf';
  return null;
}

export function parseDoc() {
  return null;
}

export function htmlSanitize(html?: string | null) {
  return html ?? '';
}

export function processImage() {
  return null;
}

export function parseYDocFromBinary() {
  return null;
}

export function parseYDocToMarkdown() {
  return '';
}

export function parsePageDocFromBinary() {
  return null;
}

export function parseWorkspaceDocFromBinary() {
  return null;
}

export function readAllDocIdsFromRootDoc() {
  return [];
}

export function createDocWithMarkdown() {
  return Buffer.alloc(0);
}

export function updateDocWithMarkdown() {
  return Buffer.alloc(0);
}

export function addDocToRootDoc() {
  return Buffer.alloc(0);
}

export function buildPublicRootDoc() {
  return Buffer.alloc(0);
}

export function updateDocTitle() {
  return Buffer.alloc(0);
}

export function updateDocProperties() {
  return Buffer.alloc(0);
}

export function updateRootDocMetaTitle() {
  return Buffer.alloc(0);
}

export type NativeLlmProtocol =
  | 'openai_chat'
  | 'openai_responses'
  | 'anthropic'
  | 'gemini';

export type NativeLlmBackendConfig = {
  base_url: string;
  auth_token: string;
  request_layer?:
    | 'anthropic'
    | 'chat_completions'
    | 'cloudflare_workers_ai'
    | 'responses'
    | 'vertex'
    | 'vertex_anthropic'
    | 'gemini_api'
    | 'gemini_vertex';
  headers?: Record<string, string>;
  no_streaming?: boolean;
  timeout_ms?: number;
};

export type NativeLlmCoreRole = 'system' | 'user' | 'assistant' | 'tool';

export type NativeLlmCoreContent =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string; signature?: string }
  | {
      type: 'tool_call';
      call_id: string;
      name: string;
      arguments: Record<string, unknown>;
      arguments_text?: string;
      arguments_error?: string;
      thought?: string;
    }
  | {
      type: 'tool_result';
      call_id: string;
      output: unknown;
      is_error?: boolean;
      name?: string;
      arguments?: Record<string, unknown>;
      arguments_text?: string;
      arguments_error?: string;
    }
  | { type: 'image'; source: Record<string, unknown> | string }
  | { type: 'audio'; source: Record<string, unknown> | string }
  | { type: 'file'; source: Record<string, unknown> | string };

export type NativeLlmCoreMessage = {
  role: NativeLlmCoreRole;
  content: NativeLlmCoreContent[];
};

export type NativeLlmToolDefinition = {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
};

export type NativeLlmRequest = {
  model: string;
  messages: NativeLlmCoreMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  tools?: NativeLlmToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { name: string };
  include?: string[];
  reasoning?: Record<string, unknown>;
  response_schema?: Record<string, unknown>;
  middleware?: {
    request?: Array<
      'normalize_messages' | 'clamp_max_tokens' | 'tool_schema_rewrite'
    >;
    stream?: Array<'stream_event_normalize' | 'citation_indexing'>;
    config?: {
      additional_properties_policy?: 'preserve' | 'forbid';
      property_format_policy?: 'preserve' | 'drop';
      property_min_length_policy?: 'preserve' | 'drop';
      array_min_items_policy?: 'preserve' | 'drop';
      array_max_items_policy?: 'preserve' | 'drop';
      max_tokens_cap?: number;
    };
  };
};

export type NativeLlmStructuredRequest = {
  model: string;
  messages: NativeLlmCoreMessage[];
  schema: Record<string, unknown>;
  max_tokens?: number;
  temperature?: number;
  reasoning?: Record<string, unknown>;
  strict?: boolean;
  response_mime_type?: string;
  middleware?: NativeLlmRequest['middleware'];
};

export type NativeLlmEmbeddingRequest = {
  model: string;
  inputs: string[];
  dimensions?: number;
  task_type?: string;
};

export type NativeLlmRerankCandidate = {
  id?: string;
  text: string;
};

export type NativeLlmRerankRequest = {
  model: string;
  query: string;
  candidates: NativeLlmRerankCandidate[];
  top_n?: number;
};

export type NativeLlmDispatchResponse = {
  id: string;
  model: string;
  message: NativeLlmCoreMessage;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cached_tokens?: number;
  };
  finish_reason:
    | 'stop'
    | 'length'
    | 'tool_calls'
    | 'content_filter'
    | 'error'
    | string;
  reasoning_details?: unknown;
};

export type NativeLlmStructuredResponse = {
  id: string;
  model: string;
  output_text: string;
  usage: NativeLlmDispatchResponse['usage'];
  finish_reason: NativeLlmDispatchResponse['finish_reason'];
  reasoning_details?: unknown;
};

export type NativeLlmEmbeddingResponse = {
  model: string;
  embeddings: number[][];
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
};

export type NativeLlmRerankResponse = {
  model: string;
  scores: number[];
};

export type NativeLlmStreamEvent =
  | { type: 'message_start'; id?: string; model?: string }
  | { type: 'text_delta'; text: string }
  | { type: 'reasoning_delta'; text: string }
  | {
      type: 'tool_call_delta';
      call_id: string;
      name?: string;
      arguments_delta: string;
    }
  | {
      type: 'tool_call';
      call_id: string;
      name: string;
      arguments: Record<string, unknown>;
      arguments_text?: string;
      arguments_error?: string;
      thought?: string;
    }
  | {
      type: 'tool_result';
      call_id: string;
      output: unknown;
      is_error?: boolean;
      name?: string;
      arguments?: Record<string, unknown>;
      arguments_text?: string;
      arguments_error?: string;
    }
  | { type: 'citation'; index: number; url: string }
  | {
      type: 'usage';
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cached_tokens?: number;
      };
    }
  | {
      type: 'done';
      finish_reason?: NativeLlmDispatchResponse['finish_reason'];
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cached_tokens?: number;
      };
    }
  | { type: 'error'; message: string; code?: string; raw?: string };

function stringifyOutput(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null);
}

function getOpenAIBaseUrl(config: NativeLlmBackendConfig) {
  const base = (config.base_url || 'https://api.openai.com').replace(
    /\/+$/,
    ''
  );
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

function toOpenAIContent(contents: NativeLlmCoreContent[] = []) {
  const parts: Array<Record<string, unknown>> = [];

  for (const item of contents) {
    if (item.type === 'text' || item.type === 'reasoning') {
      if (item.text) {
        parts.push({ type: 'text', text: item.text });
      }
      continue;
    }

    if (item.type === 'image') {
      const source = item.source;
      const url =
        typeof source === 'string'
          ? source
          : (source.url as string | undefined) ||
            ((source.image_url as Record<string, unknown> | undefined)
              ?.url as string | undefined) ||
            (source.image_url as string | undefined);
      if (url) {
        parts.push({ type: 'image_url', image_url: { url } });
      }
      continue;
    }

    if (item.type === 'file' || item.type === 'audio') {
      parts.push({ type: 'text', text: stringifyOutput(item.source) });
    }
  }

  if (parts.every(part => part.type === 'text')) {
    return parts.map(part => part.text).join('\n');
  }

  return parts;
}

function toOpenAIMessages(messages: NativeLlmCoreMessage[] = []) {
  const out: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    const content = message.content || [];

    if (message.role === 'tool') {
      for (const item of content) {
        if (item.type !== 'tool_result') continue;
        out.push({
          role: 'tool',
          tool_call_id: item.call_id,
          content: stringifyOutput(item.output),
        });
      }
      continue;
    }

    const toolCalls = content.filter(item => item.type === 'tool_call');
    if (toolCalls.length) {
      out.push({
        role: 'assistant',
        content: toOpenAIContent(
          content.filter(item => item.type !== 'tool_call')
        ),
        tool_calls: toolCalls.map(item => ({
          id: item.call_id,
          type: 'function',
          function: {
            name: item.name,
            arguments:
              item.arguments_text || JSON.stringify(item.arguments || {}),
          },
        })),
      });
      continue;
    }

    const role =
      message.role === 'assistant'
        ? 'assistant'
        : message.role === 'system'
          ? 'system'
          : 'user';
    out.push({ role, content: toOpenAIContent(content) });
  }

  return out;
}

function toOpenAITools(tools?: NativeLlmToolDefinition[]) {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || { type: 'object', properties: {} },
    },
  }));
}

function buildOpenAIChatBody(request: NativeLlmRequest, stream: boolean) {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: toOpenAIMessages(request.messages),
    stream,
  };

  if (request.max_tokens !== undefined) body.max_tokens = request.max_tokens;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  const tools = toOpenAITools(request.tools);
  if (tools) {
    body.tools = tools;
    body.tool_choice = request.tool_choice || 'auto';
  }

  return body;
}

async function fetchOpenAI(
  config: NativeLlmBackendConfig,
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
) {
  const res = await fetch(`${getOpenAIBaseUrl(config)}/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.auth_token}`,
      ...(config.headers || {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI request failed (${res.status}): ${text}`);
  }

  return res;
}

export async function llmDispatch(
  _protocol: NativeLlmProtocol,
  backendConfig: NativeLlmBackendConfig,
  request: NativeLlmRequest
): Promise<NativeLlmDispatchResponse> {
  const res = await fetchOpenAI(
    backendConfig,
    'chat/completions',
    buildOpenAIChatBody(request, false)
  );
  const json = await res.json();
  const choice = json.choices?.[0] || {};
  const content = choice.message?.content || '';
  return {
    id: json.id || '',
    model: json.model || request.model,
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: content }],
    },
    usage: {
      prompt_tokens: json.usage?.prompt_tokens || 0,
      completion_tokens: json.usage?.completion_tokens || 0,
      total_tokens: json.usage?.total_tokens || 0,
    },
    finish_reason: choice.finish_reason || 'stop',
  };
}

export async function llmStructuredDispatch(
  _protocol: NativeLlmProtocol,
  backendConfig: NativeLlmBackendConfig,
  request: NativeLlmStructuredRequest
): Promise<NativeLlmStructuredResponse> {
  const chatRequest: NativeLlmRequest = {
    model: request.model,
    messages: request.messages,
    max_tokens: request.max_tokens,
    temperature: request.temperature,
  };
  const body = buildOpenAIChatBody(chatRequest, false);
  body.response_format = request.strict
    ? {
        type: 'json_schema',
        json_schema: {
          name: 'affine_response',
          strict: true,
          schema: request.schema || { type: 'object', properties: {} },
        },
      }
    : { type: 'json_object' };

  const res = await fetchOpenAI(backendConfig, 'chat/completions', body);
  const json = await res.json();
  const choice = json.choices?.[0] || {};
  const outputText = choice.message?.content || '';
  return {
    id: json.id || '',
    model: json.model || request.model,
    output_text: outputText,
    usage: {
      prompt_tokens: json.usage?.prompt_tokens || 0,
      completion_tokens: json.usage?.completion_tokens || 0,
      total_tokens: json.usage?.total_tokens || 0,
    },
    finish_reason: choice.finish_reason || 'stop',
  };
}

export async function llmEmbeddingDispatch(
  _protocol: NativeLlmProtocol,
  backendConfig: NativeLlmBackendConfig,
  request: NativeLlmEmbeddingRequest
): Promise<NativeLlmEmbeddingResponse> {
  const body: Record<string, unknown> = {
    model: request.model,
    input: request.inputs || [],
  };
  if (request.dimensions !== undefined) body.dimensions = request.dimensions;

  const res = await fetchOpenAI(backendConfig, 'embeddings', body);
  const json = await res.json();
  return {
    model: json.model || request.model,
    embeddings: (json.data || []).map(
      (item: { embedding: number[] }) => item.embedding
    ),
    usage: json.usage
      ? {
          prompt_tokens: json.usage.prompt_tokens || 0,
          total_tokens: json.usage.total_tokens || 0,
        }
      : undefined,
  };
}

export async function llmRerankDispatch(
  _protocol: NativeLlmProtocol,
  _backendConfig: NativeLlmBackendConfig,
  _request: NativeLlmRerankRequest
): Promise<NativeLlmRerankResponse> {
  throw new Error('LLM rerank dispatch is not available in this build');
}

export class NativeStreamAdapter<T> implements AsyncIterableIterator<T> {
  readonly #queue: T[] = [];
  readonly #waiters: ((result: IteratorResult<T>) => void)[] = [];
  readonly #handle: { abort?: () => void } | undefined;
  readonly #signal?: AbortSignal;
  readonly #abortListener?: () => void;
  #ended = false;

  constructor(
    handle: { abort?: () => void } | undefined,
    signal?: AbortSignal
  ) {
    this.#handle = handle;
    this.#signal = signal;

    if (signal?.aborted) {
      this.close(true);
      return;
    }

    if (signal) {
      this.#abortListener = () => {
        this.close(true);
      };
      signal.addEventListener('abort', this.#abortListener, { once: true });
    }
  }

  private close(abortHandle: boolean) {
    if (this.#ended) {
      return;
    }

    this.#ended = true;
    if (this.#signal && this.#abortListener) {
      this.#signal.removeEventListener('abort', this.#abortListener);
    }
    if (abortHandle) {
      this.#handle?.abort?.();
    }

    while (this.#waiters.length) {
      const waiter = this.#waiters.shift();
      waiter?.({ value: undefined as T, done: true });
    }
  }

  push(value: T | null) {
    if (this.#ended) {
      return;
    }

    if (value === null) {
      this.close(false);
      return;
    }

    const waiter = this.#waiters.shift();
    if (waiter) {
      waiter({ value, done: false });
      return;
    }

    this.#queue.push(value);
  }

  [Symbol.asyncIterator]() {
    return this;
  }

  async next(): Promise<IteratorResult<T>> {
    if (this.#queue.length > 0) {
      const value = this.#queue.shift() as T;
      return { value, done: false };
    }

    if (this.#ended) {
      return { value: undefined as T, done: true };
    }

    return await new Promise(resolve => {
      this.#waiters.push(resolve);
    });
  }

  async return(): Promise<IteratorResult<T>> {
    this.close(true);

    return { value: undefined as T, done: true };
  }
}

export function llmDispatchStream(
  _protocol: NativeLlmProtocol,
  backendConfig: NativeLlmBackendConfig,
  request: NativeLlmRequest,
  signal?: AbortSignal
): AsyncIterableIterator<NativeLlmStreamEvent> {
  let adapter: NativeStreamAdapter<NativeLlmStreamEvent> | undefined;
  const buffer: (NativeLlmStreamEvent | null)[] = [];
  let pushFn = (event: NativeLlmStreamEvent | null) => {
    buffer.push(event);
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const handle = {
    abort,
  };

  (async () => {
    try {
      const res = await fetchOpenAI(
        backendConfig,
        'chat/completions',
        buildOpenAIChatBody(request, true),
        controller.signal
      );
      if (!res.body) {
        throw new Error('OpenAI stream response has no body');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let emittedDone = false;
      const toolStates = new Map<
        number,
        { id: string; name: string; argumentsText: string }
      >();

      const emit = (event: NativeLlmStreamEvent) => {
        pushFn(event);
      };

      const emitDone = (
        finishReason: NativeLlmDispatchResponse['finish_reason'] = 'stop'
      ) => {
        if (emittedDone) return;
        emittedDone = true;
        emit({ type: 'done', finish_reason: finishReason });
      };

      const flushToolCalls = () => {
        for (const state of toolStates.values()) {
          if (!state.name) continue;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(state.argumentsText || '{}');
          } catch {
            args = {};
          }
          emit({
            type: 'tool_call',
            call_id: state.id,
            name: state.name,
            arguments: args,
            arguments_text: state.argumentsText || '{}',
          });
        }
        toolStates.clear();
      };

      const closeStream = () => {
        flushToolCalls();
        emitDone();
        pushFn(null);
      };

      const handleData = (data: string) => {
        if (!data || data === '[DONE]') {
          closeStream();
          return;
        }

        let json: any;
        try {
          json = JSON.parse(data);
        } catch {
          return;
        }
        const choice = json.choices?.[0];
        const delta = choice?.delta || {};

        if (delta.content) {
          emit({ type: 'text_delta', text: delta.content });
        }
        if (delta.reasoning_content || delta.reasoning) {
          emit({
            type: 'reasoning_delta',
            text: delta.reasoning_content || delta.reasoning,
          });
        }

        for (const toolCall of delta.tool_calls || []) {
          const index = toolCall.index ?? 0;
          const state =
            toolStates.get(index) ||
            ({
              id: toolCall.id || `tool-${index}`,
              name: '',
              argumentsText: '',
            } satisfies {
              id: string;
              name: string;
              argumentsText: string;
            });
          if (toolCall.id) state.id = toolCall.id;
          if (toolCall.function?.name) state.name = toolCall.function.name;
          const argumentsDelta = toolCall.function?.arguments || '';
          state.argumentsText += argumentsDelta;
          toolStates.set(index, state);
          emit({
            type: 'tool_call_delta',
            call_id: state.id,
            name: toolCall.function?.name,
            arguments_delta: argumentsDelta,
          });
        }

        if (choice?.finish_reason === 'tool_calls') {
          flushToolCalls();
        } else if (choice?.finish_reason) {
          emitDone(choice.finish_reason);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        const events = textBuffer.split('\n\n');
        textBuffer = events.pop() || '';

        for (const event of events) {
          const data = event
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trim())
            .join('\n');
          handleData(data);
        }
      }

      if (textBuffer.trim()) {
        const data = textBuffer
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim())
          .join('\n');
        handleData(data);
      }

      closeStream();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushFn({ type: 'error', message, raw: message });
      pushFn(null);
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  })();

  adapter = new NativeStreamAdapter(handle, signal);
  pushFn = event => {
    adapter.push(event);
  };
  for (const event of buffer) {
    adapter.push(event);
  }
  return adapter;
}
