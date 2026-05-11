'use strict';

let _pipeline = null;

async function _getEmbedder() {
  if (_pipeline) return _pipeline;
  const { pipeline } = require('@xenova/transformers');
  _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return _pipeline;
}

async function generateEmbedding(text) {
  try {
    if (!text) return null;
    const embedder = await _getEmbedder();
    const output = await embedder(text);
    const float32 = new Float32Array(output.data);
    return Buffer.from(float32.buffer);
  } catch {
    return null;
  }
}

module.exports = { generateEmbedding };
