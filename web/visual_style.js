import { app } from "../../scripts/app.js";

/*
 * comfyui-Visual Style Node — 风格类别图库选择器
 *
 * 一级目录：风格类别(369)，二级目录 9 大类。
 * 点选卡片 → 写回 style 下拉 → 节点输出该参考图与提示词。
 *
 * 数据与图片来自 /extensions/<本节点目录>/atlas/。
 */

const NODE_TYPES = new Set(["VisualStyleNode"]);
// 由构建脚本注入完整 URL（目录名含空格，必须编码）
const EXT_BASE = "/extensions/ComfyUI-VisualStyleNode/atlas/";
const INDEX_URL = EXT_BASE + "index.json";

const SEP = " · ";
const STYLE_WIDGET = "style";

// 单个一级目录：风格类别
const SECTION = {
  key: "style",
  title: "风格类别",
  groups: "groupsStyles",
  entries: "styles",
  label: (e) => `${e.id}${SEP}${e.generation_name}`,
  caption: (e) => `<b>${e.id}</b> ${e.name_zh || e.generation_name}`,
  sub: (e) => e.generation_name,
  search: (e) => [e.id, e.name_zh, e.generation_name, e.reference, e.traits, e.group_zh, e.group_en],
};

let ATLAS = null;
let ATLAS_LOADING = null;

async function getAtlas() {
  if (ATLAS) return ATLAS;
  if (ATLAS_LOADING) return ATLAS_LOADING;
  ATLAS_LOADING = (async () => {
    const res = await fetch(INDEX_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`数据加载失败 ${res.status} ${INDEX_URL}`);
    const data = await res.json();
    const list = data[SECTION.entries] || [];
    SECTION.byLabel = new Map(list.map((e) => [SECTION.label(e), e]));
    ATLAS = data;
    return data;
  })();
  return ATLAS_LOADING;
}

function imgUrl(relPath) {
  if (!relPath) return "";
  return EXT_BASE + relPath;
}

const CSS = `
.vs-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);
  display:flex;align-items:center;justify-content:center;
  font-family:ui-sans-serif,system-ui,"Segoe UI","Microsoft YaHei",sans-serif;}
.vs-panel{width:min(1240px,95vw);height:min(900px,93vh);background:#16181d;color:#e6e8ee;
  border:1px solid #2c303a;border-radius:12px;display:flex;flex-direction:column;
  overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.6);}
.vs-head{display:flex;align-items:center;gap:10px;padding:12px 16px;
  border-bottom:1px solid #2c303a;flex:none;}
.vs-title{font-size:15px;font-weight:600;letter-spacing:.02em;}
.vs-sub{font-size:12px;color:#8b93a5;margin-left:4px;}
.vs-search{margin-left:auto;width:260px;padding:7px 10px;background:#1e2129;
  border:1px solid #333846;border-radius:7px;color:#e6e8ee;font-size:13px;outline:none;}
.vs-search:focus{border-color:#4a7dd6;}
.vs-close{width:30px;height:30px;border-radius:7px;border:1px solid #333846;
  background:#1e2129;color:#b9c0cf;font-size:17px;cursor:pointer;line-height:1;}
.vs-close:hover{background:#2a2f3a;color:#fff;}
.vs-tabs{display:flex;gap:6px;padding:10px 16px;flex-wrap:wrap;
  border-bottom:1px solid #23262e;flex:none;}
.vs-tab{padding:6px 14px;border-radius:999px;font-size:12.5px;
  background:#2b4a86;border:1px solid #4a7dd6;color:#fff;user-select:none;}
.vs-body{display:flex;flex:1;min-height:0;}
.vs-side{width:230px;flex:none;overflow-y:auto;padding:10px 8px 16px;
  border-right:1px solid #23262e;background:#14161b;}
.vs-cat{padding:7px 10px;border-radius:6px;font-size:13px;cursor:pointer;
  color:#a9b1c1;display:flex;justify-content:space-between;gap:6px;user-select:none;}
.vs-cat:hover{background:#1e2129;color:#e6e8ee;}
.vs-cat.on{background:#26334d;color:#fff;}
.vs-cat .n{font-size:11px;color:#6b7285;}
.vs-cat.on .n{color:#9fb4dd;}
.vs-main{flex:1;overflow-y:auto;padding:14px;min-width:0;}
.vs-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));}
.vs-card{background:#1b1e25;border:1px solid #2c303a;border-radius:8px;
  overflow:hidden;cursor:pointer;transition:border-color .12s,transform .12s;}
.vs-card:hover{border-color:#4a7dd6;transform:translateY(-2px);}
.vs-card.on{border-color:#6ea8ff;box-shadow:0 0 0 1px #6ea8ff inset;}
.vs-card img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:#0f1115;}
.vs-card .cap{padding:5px 7px;font-size:11px;line-height:1.35;color:#b9c0cf;}
.vs-card .cap b{display:block;color:#e6e8ee;font-weight:600;font-size:11.5px;}
.vs-card .cap .sub{color:#6b7285;font-size:10px;display:-webkit-box;
  -webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
  line-height:1.3;word-break:break-word;}
.vs-empty{padding:40px;text-align:center;color:#6b7285;font-size:13px;}
.vs-foot{padding:9px 16px;border-top:1px solid #23262e;font-size:12px;
  color:#8b93a5;flex:none;display:flex;gap:14px;align-items:center;}
.vs-foot b{color:#dfe4ee;font-weight:600;}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  const el = document.createElement("style");
  el.textContent = CSS;
  document.head.appendChild(el);
  cssInjected = true;
}

function widgetOf(node, name) {
  return node.widgets && node.widgets.find((w) => w.name === name);
}

function setWidget(node, name, value) {
  const w = widgetOf(node, name);
  if (!w) return;
  w.value = value;
  try {
    w.callback?.(value, app.canvas, node, app.canvas?.graph_mouse);
  } catch (e) {}
  node.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas?.(true, true);
}

function openGallery(node, atlas) {
  injectCSS();

  const state = { group: null, q: "", row: "" };
  const w = widgetOf(node, STYLE_WIDGET);
  if (!w) {
    alert("未找到 style 控件，请确认节点版本与前端一致。");
    return;
  }
  state.row = w.value;

  const overlay = document.createElement("div");
  overlay.className = "vs-overlay";
  overlay.innerHTML = `
    <div class="vs-panel">
      <div class="vs-head">
        <span class="vs-title">Visual Style 风格图库</span>
        <span class="vs-sub"></span>
        <input class="vs-search" type="text" placeholder="搜索：编号 / 名称 / 作者 / 关键词" />
        <button class="vs-close" title="关闭">×</button>
      </div>
      <div class="vs-tabs"></div>
      <div class="vs-body">
        <div class="vs-side"></div>
        <div class="vs-main"></div>
      </div>
      <div class="vs-foot"><span class="picked">未选择</span></div>
    </div>`;

  const $tabs = overlay.querySelector(".vs-tabs");
  const $side = overlay.querySelector(".vs-side");
  const $main = overlay.querySelector(".vs-main");
  const $search = overlay.querySelector(".vs-search");
  const $picked = overlay.querySelector(".picked");
  const $sub = overlay.querySelector(".vs-sub");

  $sub.textContent = `${atlas[SECTION.entries].length} 风格 · ${atlas[SECTION.groups].length} 大类`;

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".vs-close").addEventListener("click", close);

  function renderTabs() {
    $tabs.innerHTML = "";
    const list = atlas[SECTION.entries] || [];
    const b = document.createElement("div");
    b.className = "vs-tab";
    b.textContent = `${SECTION.title} (${list.length})`;
    $tabs.appendChild(b);
  }

  function renderSide() {
    $side.innerHTML = "";
    const list = atlas[SECTION.entries] || [];
    const groups = atlas[SECTION.groups] || [];

    const all = document.createElement("div");
    all.className = "vs-cat" + (state.group === null ? " on" : "");
    all.innerHTML = `<span>全部</span><span class="n">${list.length}</span>`;
    all.onclick = () => {
      state.group = null;
      render();
    };
    $side.appendChild(all);

    for (const g of groups) {
      const el = document.createElement("div");
      el.className = "vs-cat" + (state.group === g.id ? " on" : "");
      el.innerHTML = `<span>${g.label_zh}</span><span class="n">${g.count ?? 0}</span>`;
      el.title = g.label_en || g.label_zh;
      el.onclick = () => {
        state.group = g.id;
        render();
      };
      $side.appendChild(el);
    }
  }

  function filtered() {
    const list = atlas[SECTION.entries] || [];
    const q = state.q.trim().toLowerCase();
    return list.filter((e) => {
      if (state.group && e.group_id !== state.group) return false;
      if (!q) return true;
      return SECTION.search(e).some((t) => (t || "").toLowerCase().includes(q));
    });
  }

  function applyPick(entry) {
    const label = SECTION.label(entry);
    state.row = label;
    setWidget(node, STYLE_WIDGET, label);
    updateFoot();
    renderMain();
  }

  function updateFoot() {
    const cur = SECTION.byLabel.get(state.row);
    if (!cur) {
      $picked.innerHTML = `<b>${SECTION.title}</b>：未选择`;
    } else {
      $picked.innerHTML = `<b>${SECTION.title}</b>：${cur.id} ${cur.name_zh || cur.generation_name || ""}`;
    }
  }

  function renderMain() {
    const list = filtered();
    const picked = state.row;
    $main.innerHTML = "";
    if (!list.length) {
      $main.innerHTML = '<div class="vs-empty">没有匹配的条目</div>';
      return;
    }
    const grid = document.createElement("div");
    grid.className = "vs-grid";
    for (const e of list) {
      const label = SECTION.label(e);
      const card = document.createElement("div");
      card.className = "vs-card" + (label === picked ? " on" : "");

      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = imgUrl(e.image);
      img.alt = e.id;
      img.onerror = () => {
        const ph = document.createElement("div");
        ph.style.cssText =
          "aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;" +
          "background:#232833;color:#6b7285;font-size:11px;text-align:center;padding:8px;";
        ph.textContent = "图片缺失";
        img.replaceWith(ph);
      };
      card.appendChild(img);

      const cap = document.createElement("div");
      cap.className = "cap";
      const subText = SECTION.sub(e);
      cap.innerHTML =
        SECTION.caption(e) + (subText ? `<span class="sub">${subText}</span>` : "");
      cap.title = [e.name_zh, e.generation_name, e.reference]
        .filter(Boolean).join(" · ");
      card.appendChild(cap);

      card.onclick = () => applyPick(e);
      grid.appendChild(card);
    }
    $main.appendChild(grid);
  }

  function render() {
    renderTabs();
    renderSide();
    renderMain();
    updateFoot();
  }

  $search.addEventListener("input", () => {
    state.q = $search.value;
    if (state.q.trim()) state.group = null;
    render();
  });

  render();
  document.body.appendChild(overlay);
  $search.focus();
}

// ---------------------------------------------------------------------------
// 节点图片预览
// ---------------------------------------------------------------------------

function ensureImage(node, slot, url) {
  const key = `_vs_${slot}`;
  if (node[key] && node[`${key}_src`] === url) return node[key];
  if (!url) {
    node[key] = null;
    node[`${key}_src`] = "";
    return null;
  }
  const img = new Image();
  img.onload = () => node.setDirtyCanvas?.(true, true);
  img.src = url;
  node[key] = img;
  node[`${key}_src`] = url;
  return img;
}

const THEME_H = 84;
const PREVIEW_H = 300;
const SPACER_NAME = "vs_preview";
const GALLERY_BTN = "打开图库";

function arrangeWidgets(node) {
  const list = node.widgets;
  if (!list) return;

  const tw = list.find((w) => w.name === "theme");
  if (tw) {
    tw.computeSize = (width) => [
      width ?? Math.max(120, (node.size?.[0] ?? 320) - 20),
      THEME_H,
    ];
  }

  let spacer = list.find((w) => w.name === SPACER_NAME);
  if (!spacer) {
    spacer = {
      name: SPACER_NAME,
      type: SPACER_NAME,
      value: null,
      options: {},
      serialize: false,
      computeSize(width) {
        return [width ?? Math.max(120, (node.size?.[0] ?? 320) - 20), PREVIEW_H];
      },
      draw() {},
    };
    list.push(spacer);
  }

  // 可见顺序：图片区 → 打开图库 → language → include_traits → theme（最下）
  const order = [SPACER_NAME, GALLERY_BTN, "language", "include_traits", "theme"];
  const picked = [];
  for (const name of order) {
    const i = list.findIndex((w) => w.name === name);
    if (i >= 0) picked.push(list.splice(i, 1)[0]);
  }
  list.push(...picked);

  node.setDirtyCanvas?.(true, true);
}

function previewRect(node) {
  const spacer = node.widgets?.find((w) => w.name === SPACER_NAME);
  if (!spacer || typeof spacer.last_y !== "number") return null;
  const pad = 8;
  const w = (node.size?.[0] ?? 0) - pad * 2;
  if (w <= 16) return null;
  return { x: pad, y: spacer.last_y, w, h: PREVIEW_H };
}

function drawPreviews(node, ctx) {
  if (!ATLAS) return;
  const rect = previewRect(node);
  if (!rect) return;

  const wid = widgetOf(node, STYLE_WIDGET);
  const entry = wid ? SECTION.byLabel.get(wid.value) : null;

  const captionH = 30;
  const imgH = Math.max(24, rect.h - captionH);

  const img = ensureImage(node, SECTION.key, entry ? imgUrl(entry.image) : "");
  if (img && img.complete && img.naturalWidth) {
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = rect.w;
    let h = w / ratio;
    if (h > imgH) {
      h = imgH;
      w = h * ratio;
    }
    ctx.drawImage(img, rect.x + (rect.w - w) / 2, rect.y, w, h);
  } else {
    ctx.fillStyle = "#1b1e25";
    ctx.fillRect(rect.x, rect.y, rect.w, imgH);
    ctx.fillStyle = "#5b6273";
    ctx.font = "11px sans-serif";
    ctx.fillText(entry ? "图片加载中…" : "尚未选择", rect.x + 8, rect.y + 18);
  }

  ctx.save();
  ctx.fillStyle = "#8fb4ff";
  ctx.font = "11px sans-serif";
  const name = entry ? (entry.name_zh || entry.generation_name || entry.id) : "—";
  ctx.fillText(`${SECTION.title} · ${name}`, rect.x, rect.y + imgH + 18);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 注册
// ---------------------------------------------------------------------------

app.registerExtension({
  name: "VisualStyle.Gallery",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (!NODE_TYPES.has(nodeData.name)) return;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated && onNodeCreated.apply(this, arguments);

      // style 下拉只在提示词拼装时用，界面上由图库按钮替代
      const sw = widgetOf(this, STYLE_WIDGET);
      if (sw) {
        sw.hidden = true;
        sw.computeSize = () => [0, -4];
      }

      const btn = this.addWidget("button", GALLERY_BTN, null, async () => {
        try {
          const atlas = await getAtlas();
          openGallery(this, atlas);
        } catch (e) {
          console.error("[Visual Style]", e);
          alert("Visual Style 图库加载失败：" + e.message);
        }
      });
      btn.serialize = false;

      this.size = [
        Math.max((this.size && this.size[0]) || 0, 340),
        Math.max((this.size && this.size[1]) || 0, 560),
      ];
      arrangeWidgets(this);
      return r;
    };

    const onDrawForeground = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
      onDrawForeground && onDrawForeground.apply(this, arguments);
      try {
        drawPreviews(this, ctx);
      } catch (e) {}
    };

    const onConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = onConfigure && onConfigure.apply(this, arguments);
      try {
        const sw = widgetOf(this, STYLE_WIDGET);
        if (sw) {
          sw.hidden = true;
          sw.computeSize = () => [0, -4];
        }
        arrangeWidgets(this);
      } catch (e) {}
      return r;
    };
  },
  async setup() {
    try {
      await getAtlas();
    } catch (e) {
      console.warn("Visual Style: 数据预加载失败", e);
    }
  },
});
