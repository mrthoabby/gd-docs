/**
 * @affine/server-native — implementación JavaScript pura
 *
 * Reemplaza el addon nativo de Rust (NAPI-rs) con equivalentes JS.
 * Elimina la dependencia de compilación de Rust en el build self-hosted.
 */

'use strict';

// mergeUpdatesInApplyWay: usa Y.js directamente (misma semántica que el nativo)
let _Y = null;
function getY() {
  if (!_Y) {
    try { _Y = require('yjs'); } catch { _Y = {}; }
  }
  return _Y;
}

function mergeUpdatesInApplyWay(updates) {
  try {
    const Y = getY();
    if (!Y.Doc) return updates[updates.length - 1] ?? new Uint8Array(0);
    const doc = new Y.Doc({ gc: false });
    for (const update of updates) {
      if (update && update.length) Y.applyUpdate(doc, update);
    }
    return Y.encodeStateAsUpdate(doc);
  } catch {
    return updates[updates.length - 1] ?? new Uint8Array(0);
  }
}

// hashcash — sin validación nativa: siempre pasa (self-hosted sin captcha)
function verifyChallengeResponse() { return true; }
function mintChallengeResponse() { return 'stub'; }

// tokenizer — deshabilitado (no afecta la app, solo conteo de tokens para AI)
function fromModelName() { return null; }

// MIME detection — stub básico
function getMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  const b = buffer;
  if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49) return 'image/webp';
  if (b[0] === 0x25 && b[1] === 0x50) return 'application/pdf';
  return null;
}

// HTML sanitize — devuelve el HTML sin modificar (self-hosted, usuarios confiables)
function htmlSanitize(html) { return html ?? ''; }

// Image processing — no-op (features de procesamiento de imágenes deshabilitadas)
function processImage() { return null; }

// Y.js doc parsing — stubs (el servidor los usa para indexación/search)
function parseDoc() { return null; }
function parseDocFromBinary() { return null; }
function parseDocToMarkdown() { return ''; }
function parsePageDoc() { return null; }
function parseWorkspaceDoc() { return null; }
function readAllDocIdsFromRootDoc() { return []; }

// Claves de licencia AFFiNE Pro — vacías (no usamos licencias)
const AFFINE_PRO_PUBLIC_KEY = '';
const AFFINE_PRO_LICENSE_AES_KEY = '';

// MCP write tools — stubs
function createDocWithMarkdown() { return null; }
function updateDocWithMarkdown() { return null; }
function addDocToRootDoc() { return null; }
function buildPublicRootDoc() { return null; }
function updateDocTitle() { return null; }
function updateDocProperties() { return null; }
function updateRootDocMetaTitle() { return null; }

// LLM dispatch JS fallback. Covers OpenAI-compatible chat and embeddings
// without compiling the Rust native module.
const LLM_STREAM_END_MARKER = '__AFFINE_LLM_STREAM_END__';

function parseJsonSafe(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function stringifyOutput(value) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null);
}

function getOpenAIBaseUrl(config) {
  const base = (config.base_url || 'https://api.openai.com').replace(/\/+$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

function toOpenAIContent(contents) {
  const parts = [];

  for (const item of contents || []) {
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
          : source?.url || source?.image_url?.url || source?.image_url;
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

function toOpenAIMessages(messages) {
  const out = [];

  for (const message of messages || []) {
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

function toOpenAITools(tools) {
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

function buildOpenAIChatBody(request, stream) {
  const body = {
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

async function fetchOpenAI(config, path, body, signal) {
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

async function llmDispatch(_protocol, backendConfigJson, requestJson) {
  const config = parseJsonSafe(backendConfigJson);
  const request = parseJsonSafe(requestJson);
  const res = await fetchOpenAI(
    config,
    'chat/completions',
    buildOpenAIChatBody(request, false)
  );
  const json = await res.json();
  const choice = json.choices?.[0] || {};
  const content = choice.message?.content || '';

  return JSON.stringify({
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
  });
}

async function llmStructuredDispatch(_protocol, backendConfigJson, requestJson) {
  const request = parseJsonSafe(requestJson);
  const chatRequest = {
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

  const config = parseJsonSafe(backendConfigJson);
  const res = await fetchOpenAI(config, 'chat/completions', body);
  const json = await res.json();
  const choice = json.choices?.[0] || {};
  const outputText = choice.message?.content || '';

  return JSON.stringify({
    id: json.id || '',
    model: json.model || request.model,
    output_text: outputText,
    usage: {
      prompt_tokens: json.usage?.prompt_tokens || 0,
      completion_tokens: json.usage?.completion_tokens || 0,
      total_tokens: json.usage?.total_tokens || 0,
    },
    finish_reason: choice.finish_reason || 'stop',
  });
}

async function llmEmbeddingDispatch(_protocol, backendConfigJson, requestJson) {
  const config = parseJsonSafe(backendConfigJson);
  const request = parseJsonSafe(requestJson);
  const body = {
    model: request.model,
    input: request.inputs || [],
  };
  if (request.dimensions !== undefined) body.dimensions = request.dimensions;

  const res = await fetchOpenAI(config, 'embeddings', body);
  const json = await res.json();

  return JSON.stringify({
    model: json.model || request.model,
    embeddings: (json.data || []).map(item => item.embedding),
    usage: json.usage
      ? {
          prompt_tokens: json.usage.prompt_tokens || 0,
          total_tokens: json.usage.total_tokens || 0,
        }
      : undefined,
  });
}

const llmRerankDispatch = undefined;

function llmDispatchStream(_protocol, backendConfigJson, requestJson, callback) {
  const controller = new AbortController();

  (async () => {
    const config = parseJsonSafe(backendConfigJson);
    const request = parseJsonSafe(requestJson);
    const res = await fetchOpenAI(
      config,
      'chat/completions',
      buildOpenAIChatBody(request, true),
      controller.signal
    );

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let closed = false;
    let emittedDone = false;
    const toolStates = new Map();

    function emit(event) {
      callback(null, JSON.stringify(event));
    }

    function emitDone(finishReason = 'stop') {
      if (emittedDone) return;
      emittedDone = true;
      emit({ type: 'done', finish_reason: finishReason });
    }

    function closeStream() {
      if (closed) return;
      closed = true;
      emitDone();
      callback(null, LLM_STREAM_END_MARKER);
    }

    function flushToolCalls() {
      for (const state of toolStates.values()) {
        if (!state.name) continue;
        emit({
          type: 'tool_call',
          call_id: state.id,
          name: state.name,
          arguments: parseJsonSafe(state.argumentsText || '{}'),
          arguments_text: state.argumentsText || '{}',
        });
      }
      toolStates.clear();
    }

    function handleData(data) {
      if (!data || data === '[DONE]') {
        flushToolCalls();
        closeStream();
        return;
      }

      const json = parseJsonSafe(data, null);
      if (!json) return;
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
          {
            id: toolCall.id || `tool-${index}`,
            name: '',
            argumentsText: '',
          };
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
    }

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const data = event
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim())
          .join('\n');
        handleData(data);
      }
    }

    if (buffer.trim()) {
      const data = buffer
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('\n');
      handleData(data);
    }

    flushToolCalls();
    closeStream();
  })().catch(error => {
    callback(error, error instanceof Error ? error.message : String(error));
    callback(null, LLM_STREAM_END_MARKER);
  });

  return {
    abort() {
      controller.abort();
    },
  };
}

module.exports = {
  mergeUpdatesInApplyWay,
  verifyChallengeResponse,
  mintChallengeResponse,
  fromModelName,
  getMime,
  htmlSanitize,
  processImage,
  parseDoc,
  parseDocFromBinary,
  parseDocToMarkdown,
  parsePageDoc,
  parseWorkspaceDoc,
  readAllDocIdsFromRootDoc,
  AFFINE_PRO_PUBLIC_KEY,
  AFFINE_PRO_LICENSE_AES_KEY,
  createDocWithMarkdown,
  updateDocWithMarkdown,
  addDocToRootDoc,
  buildPublicRootDoc,
  updateDocTitle,
  updateDocProperties,
  updateRootDocMetaTitle,
  llmDispatch,
  llmStructuredDispatch,
  llmEmbeddingDispatch,
  llmRerankDispatch,
  llmDispatchStream,
};
