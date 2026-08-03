/**
 * Structured JSON diff by path (objects/arrays).
 */

/**
 * @typedef {{ op: "add" | "del" | "chg"; path: string; left?: unknown; right?: unknown }} DiffOp
 */

/**
 * @param {unknown} left
 * @param {unknown} right
 * @param {string} [path]
 * @returns {DiffOp[]}
 */
export function diffJson(left, right, path = "$") {
  /** @type {DiffOp[]} */
  const ops = [];
  walk(left, right, path, ops);
  return ops;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @param {string} path
 * @param {DiffOp[]} ops
 */
function walk(a, b, path, ops) {
  if (Object.is(a, b)) return;
  if (a === null || b === null || typeof a !== typeof b) {
    ops.push({ op: "chg", path, left: a, right: b });
    return;
  }
  if (typeof a !== "object") {
    ops.push({ op: "chg", path, left: a, right: b });
    return;
  }
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) {
    ops.push({ op: "chg", path, left: a, right: b });
    return;
  }
  if (aArr && bArr) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const p = `${path}[${i}]`;
      if (i >= a.length) ops.push({ op: "add", path: p, right: b[i] });
      else if (i >= b.length) ops.push({ op: "del", path: p, left: a[i] });
      else walk(a[i], b[i], p, ops);
    }
    return;
  }
  const ao = /** @type {Record<string, unknown>} */ (a);
  const bo = /** @type {Record<string, unknown>} */ (b);
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const key of [...keys].sort()) {
    const p = path === "$" ? `$.${key}` : `${path}.${key}`;
    const hasA = Object.prototype.hasOwnProperty.call(ao, key);
    const hasB = Object.prototype.hasOwnProperty.call(bo, key);
    if (!hasA) ops.push({ op: "add", path: p, right: bo[key] });
    else if (!hasB) ops.push({ op: "del", path: p, left: ao[key] });
    else walk(ao[key], bo[key], p, ops);
  }
}

/** @param {unknown} v */
export function previewValue(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (v === undefined) return "undefined";
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  } catch {
    return String(v);
  }
}

/** @param {DiffOp[]} ops */
export function formatOps(ops) {
  return ops
    .map((op) => {
      if (op.op === "add") return `+ ${op.path} = ${previewValue(op.right)}`;
      if (op.op === "del") return `- ${op.path} = ${previewValue(op.left)}`;
      return `~ ${op.path}: ${previewValue(op.left)} → ${previewValue(op.right)}`;
    })
    .join("\n");
}
