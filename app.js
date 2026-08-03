import { diffJson, formatOps, previewValue } from "./diff.js";

const SAMPLE_LEFT = `{
  "name": "demo",
  "version": 1,
  "tags": ["a", "b"],
  "meta": { "draft": true }
}`;

const SAMPLE_RIGHT = `{
  "name": "demo",
  "version": 2,
  "tags": ["a", "c"],
  "meta": { "draft": false, "owner": "sam" },
  "extra": true
}`;

const leftEl = document.getElementById("left");
const rightEl = document.getElementById("right");
const outEl = document.getElementById("out");
const statusEl = document.getElementById("status");
const pathLabel = document.getElementById("path-label");
const btnReload = document.getElementById("btn-reload");
const btnClose = document.getElementById("btn-close");
const btnSample = document.getElementById("btn-sample");

/** @type {"standalone" | "tool"} */
let session = "standalone";
let focusPath = "";

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || "請求失敗");
    err.code = data.code;
    throw err;
  }
  return data;
}

function syncChrome() {
  pathLabel.textContent =
    session === "tool" ? `工具 · ${focusPath || "—"}` : "本機試寫";
  btnReload.hidden = session !== "tool";
  btnClose.hidden = session !== "tool";
  leftEl.readOnly = session === "tool";
}

function run() {
  outEl.innerHTML = "";
  let left;
  let right;
  try {
    left = leftEl.value.trim() ? JSON.parse(leftEl.value) : null;
  } catch (e) {
    setStatus(`左：${e instanceof Error ? e.message : String(e)}`, "bad");
    return;
  }
  try {
    right = rightEl.value.trim() ? JSON.parse(rightEl.value) : null;
  } catch (e) {
    setStatus(`右：${e instanceof Error ? e.message : String(e)}`, "bad");
    return;
  }
  if (leftEl.value.trim() === "" && rightEl.value.trim() === "") {
    setStatus("待命");
    return;
  }
  const ops = diffJson(left, right);
  if (!ops.length) {
    setStatus("相同", "ok");
    const div = document.createElement("div");
    div.className = "diff-line same";
    div.textContent = "（無差異）";
    outEl.appendChild(div);
    return;
  }
  const adds = ops.filter((o) => o.op === "add").length;
  const dels = ops.filter((o) => o.op === "del").length;
  const chgs = ops.filter((o) => o.op === "chg").length;
  setStatus(`+${adds}  −${dels}  ~${chgs}`, "ok");
  for (const op of ops) {
    const div = document.createElement("div");
    div.className = `diff-line ${op.op}`;
    if (op.op === "add") {
      div.textContent = `+ ${op.path} = ${previewValue(op.right)}`;
    } else if (op.op === "del") {
      div.textContent = `- ${op.path} = ${previewValue(op.left)}`;
    } else {
      div.textContent = `~ ${op.path}: ${previewValue(op.left)} → ${previewValue(op.right)}`;
    }
    outEl.appendChild(div);
  }
}

async function loadGrantAndFile() {
  const grant = await api("/api/tool/grant");
  session = "tool";
  focusPath =
    grant.focusPath ||
    (Array.isArray(grant.paths) && grant.paths[0]) ||
    "";
  syncChrome();
  if (!focusPath) {
    setStatus("沒有 focusPath", "bad");
    return;
  }
  const file = await api(
    "/api/tool/file?" + new URLSearchParams({ path: focusPath })
  );
  leftEl.value = file.content ?? "";
  run();
  setStatus(`已載入左檔 · 請貼上右側 JSON`, "ok");
}

leftEl.addEventListener("input", run);
rightEl.addEventListener("input", run);

document.getElementById("btn-swap").addEventListener("click", () => {
  if (session === "tool") {
    setStatus("工具模式左側唯讀，無法對調", "bad");
    return;
  }
  const t = leftEl.value;
  leftEl.value = rightEl.value;
  rightEl.value = t;
  run();
});

document.getElementById("btn-copy").addEventListener("click", async () => {
  try {
    let left;
    let right;
    try {
      left = JSON.parse(leftEl.value);
      right = JSON.parse(rightEl.value);
    } catch {
      setStatus("兩邊都需是有效 JSON 才能複製", "bad");
      return;
    }
    await navigator.clipboard.writeText(formatOps(diffJson(left, right)));
    setStatus("已複製", "ok");
  } catch {
    setStatus("無法寫入剪貼簿", "bad");
  }
});

btnSample.addEventListener("click", () => {
  if (session === "tool") {
    rightEl.value = SAMPLE_RIGHT;
  } else {
    leftEl.value = SAMPLE_LEFT;
    rightEl.value = SAMPLE_RIGHT;
  }
  run();
});

btnReload.addEventListener("click", () => {
  void loadGrantAndFile().catch((e) =>
    setStatus(e instanceof Error ? e.message : String(e), "bad")
  );
});

btnClose.addEventListener("click", () => {
  void api("/api/tool/close", {
    method: "POST",
    body: JSON.stringify({ dirty: false }),
  }).catch((e) =>
    setStatus(e instanceof Error ? e.message : String(e), "bad")
  );
});

void loadGrantAndFile().catch(() => {
  session = "standalone";
  syncChrome();
  leftEl.value = SAMPLE_LEFT;
  rightEl.value = SAMPLE_RIGHT;
  run();
});
