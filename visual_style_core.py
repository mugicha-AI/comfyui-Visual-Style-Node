"""Visual Style Node 索引加载与提示词拼装（纯 Python，无 GPU 依赖）。

数据来源：节点包内的 web/atlas/index.json（仅「风格类别」一个板块），
图片来源：web/atlas/styles/*.webp。

提示词拼装规则参照上游 skills/handdraw-style-prompter/scripts/prompt_style.py，
但做了本机化修正：编号只做内部键、提示词里只出现自然语言名称，
避免生图模型把 FA-001 这类代码当成画面文字画出来。
"""

from __future__ import annotations

import json
import os
import re

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
ATLAS_DIR = os.path.join(NODE_DIR, "web", "atlas")
INDEX_FILE = os.path.join(ATLAS_DIR, "index.json")

CJK = re.compile(r"[\u3400-\u9fff]")
NEGATIVE_MARK = ("避免", "不要", "不准", "禁止")

_cache = None


def load_index() -> dict:
    global _cache
    if _cache is None:
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        _cache = {
            "styles": {s["id"]: s for s in raw["styles"]},
            "style_order": [s["id"] for s in raw["styles"]],
            "groupsStyles": raw["groupsStyles"],
        }
    return _cache


def style_ids() -> list[str]:
    return load_index()["style_order"]


def detect_language(text: str) -> str:
    return "zh" if CJK.search(text or "") else "en"


def positive_traits(traits: str) -> str:
    """剔除含否定词的从句（否定式指令在生图模型里会被反向执行）。"""
    if not traits:
        return ""
    kept = []
    for part in re.split(r"[；;。\n]+", traits):
        part = part.strip(" ，,、：:。；;\t")
        if not part:
            continue
        if any(word in part for word in NEGATIVE_MARK):
            continue
        kept.append(part)
    return "；".join(kept)


def _style_block(style_id: str, lang: str, include_traits: bool) -> tuple[str, str]:
    """返回 (提示词片段, 风格显示名)。"""
    s = load_index()["styles"].get(style_id)
    if not s:
        return "", ""
    name = s["generation_name"]
    ref = s.get("reference", "")
    traits = positive_traits(s.get("traits", "")) if include_traits else ""

    if lang == "zh":
        parts = [f"风格名称：{name}。"]
        if ref:
            parts.append(f"参考作者/风格名称：{ref}。")
        if traits:
            parts.append(f"核心风格特征：{traits}。")
        return "".join(parts), name

    parts = [f"Style name: {name}."]
    if ref:
        parts.append(f" Reference author/style name: {ref}.")
    if traits:
        parts.append(f" Core style traits: {traits}.")
    return "".join(parts), name


def build_prompt(
    style: str = "",
    theme: str = "",
    language: str = "auto",
    include_traits: bool = True,
) -> dict:
    """拼出最终提示词：风格类别 + 主题，返回 prompt / 显示名。"""
    lang = detect_language(theme) if language == "auto" else language
    style_block, style_name = _style_block(style, lang, include_traits)
    if lang == "zh":
        theme_line = f"主题：{theme}。"
        prompt = f"{style_block}{theme_line}"
    else:
        theme_line = f"Theme: {theme}."
        prompt = " ".join(p for p in (style_block, theme_line) if p).strip()

    return {
        "prompt": prompt.strip(),
        "language": lang,
        "style_name": style_name,
    }


def asset_path(ident: str) -> str | None:
    """把风格编号解析为 web/atlas 下的绝对路径。"""
    rec = load_index()["styles"].get(ident)
    if not rec:
        return None
    rel = rec.get("image", "")
    if not rel:
        return None
    return os.path.join(ATLAS_DIR, rel.replace("/", os.sep))
