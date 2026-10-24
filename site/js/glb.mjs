// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// A small GLB (glTF 2.0 binary) reader for the ship models under site/assets/ships/. It covers exactly what those
// files use: one scene, one node, one mesh of triangle primitives with POSITION, NORMAL, COLOR_0 and indices,
// quantised per KHR_mesh_quantization (int16 positions scaled and offset by the node, int8 normals, uint8 RGBA
// colours). No materials, textures, skins, animation or external buffers. Typed-array views are taken straight on
// the downloaded buffer, so nothing is copied before the upload to the GPU.
import { Geometry } from '../vendor/ogl.mjs';

const ARRAY = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const MAGIC = 0x46546c67, CHUNK_JSON = 0x4e4f534a, CHUNK_BIN = 0x004e4942;

/** Split a GLB ArrayBuffer into its JSON document and its binary chunk (a Uint8Array view, or null). */
export function parseGlb(buf) {
  const dv = new DataView(buf);
  if (dv.byteLength < 20 || dv.getUint32(0, true) !== MAGIC || dv.getUint32(4, true) !== 2) throw new Error('not a glTF 2.0 binary');
  let off = 12, json = null, bin = null;
  while (off + 8 <= dv.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true); off += 8;
    if (off + len > dv.byteLength) throw new Error('truncated GLB chunk');
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off, len)));
    else if (type === CHUNK_BIN && !bin) bin = new Uint8Array(buf, off, len);
    off += len;
  }
  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, bin };
}

// One accessor as an OGL attribute: { size, data, type, normalized, stride, count }. The glTF component types are
// the WebGL enum values, so `type` passes straight through to vertexAttribPointer / drawElements.
function attribute(json, bin, i) {
  const a = json.accessors[i], bv = json.bufferViews[a.bufferView], T = ARRAY[a.componentType], size = SIZE[a.type];
  if (!T || !size || a.sparse) throw new Error(`unsupported accessor ${i}`);
  const stride = bv.byteStride || 0, start = bin.byteOffset + bv.byteOffset + (a.byteOffset || 0);
  const bytes = stride ? stride * (a.count - 1) + size * T.BYTES_PER_ELEMENT : a.count * size * T.BYTES_PER_ELEMENT;
  // a view on the download when it is aligned (always, for our own exporter), a copy otherwise
  const data = start % T.BYTES_PER_ELEMENT === 0 ? new T(bin.buffer, start, bytes / T.BYTES_PER_ELEMENT)
    : new T(bin.buffer.slice(start, start + bytes));
  return { size, data, type: a.componentType, normalized: !!a.normalized, stride, count: a.count };
}

/**
 * Build OGL geometries for the first mesh in a GLB. Returns { geometries, translation, scale, triangles, vertices }:
 * draw each geometry under a Transform with that translation and (per-axis) scale to get metres in the file's frame.
 */
export function glbGeometries(gl, buf) {
  const { json, bin } = parseGlb(buf);
  if (!bin) throw new Error('GLB has no binary chunk');
  const scene = json.scenes[json.scene || 0], node = json.nodes[scene.nodes[0]], mesh = json.meshes[node.mesh];
  if (!mesh) throw new Error('GLB has no mesh');
  let triangles = 0, vertices = 0;
  const geometries = mesh.primitives.map(p => {
    if ((p.mode ?? 4) !== 4) throw new Error('only triangle primitives are supported');
    const attrs = { position: attribute(json, bin, p.attributes.POSITION) };
    if (p.attributes.NORMAL !== undefined) attrs.normal = attribute(json, bin, p.attributes.NORMAL);
    if (p.attributes.COLOR_0 !== undefined) attrs.color = attribute(json, bin, p.attributes.COLOR_0);
    if (p.indices !== undefined) attrs.index = attribute(json, bin, p.indices);
    vertices += attrs.position.count;
    triangles += (attrs.index ? attrs.index.count : attrs.position.count) / 3;
    return new Geometry(gl, attrs);
  });
  return { geometries, translation: node.translation || [0, 0, 0], scale: node.scale || [1, 1, 1], triangles, vertices };
}

/** Fetch a GLB and build its geometries. Rejects on any network, parse or format error; the caller keeps its fallback. */
export async function loadGlb(gl, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return glbGeometries(gl, await res.arrayBuffer());
}
