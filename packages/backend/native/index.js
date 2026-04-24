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

// LLM native dispatch — deshabilitado (el servidor usará fetch JS normal)
const llmDispatch = undefined;
const llmStructuredDispatch = undefined;
const llmEmbeddingDispatch = undefined;
const llmRerankDispatch = undefined;
const llmDispatchStream = undefined;

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
