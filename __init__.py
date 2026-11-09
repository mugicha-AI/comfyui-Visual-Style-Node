"""
comfyui-Visual Style Node
=========================

把 yang0/handraw-style 的风格类别库（369 种风格，分 9 大类）
打包成 ComfyUI 节点。点「打开图库」按二级目录选图，节点直接输出
参考图 + 拼好的生图提示词。

VisualStyleNode  选 风格类别 + 手写主题 → IMAGE + STRING + STRING

数据与图片全部随节点内置（web/atlas/），不依赖外部目录或网络。
数据来源：https://github.com/yang0/handraw-style （作者 yang0，遵循其 LICENSE）。
"""

import os
import sys

import numpy as np
import torch
from PIL import Image

# ComfyUI 用目录名作为包名加载自定义节点，但不同版本加载方式不一致：
# 先用相对导入，失败则把本目录塞进 sys.path 再按顶层模块导入。
try:
    from . import visual_style_core as core
except ImportError:  # pragma: no cover - 兼容直接按目录加载的旧版本
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import visual_style_core as core

ATLAS_DIR = core.ATLAS_DIR
# 前端静态目录改由 pyproject.toml 的 [tool.comfy] web 注册：
# 那里 project.name 是不含空格的 ComfyUI-VisualStyleNode。
# 这里不能再设 WEB_DIRECTORY，否则 nodes.py 会用「含空格的目录名」重复注册一次，
# 生成 /extensions/comfyui-Visual%20Style%20Node/ 这种 aiohttp 必 404 的路由。

SEP = " · "
PLACEHOLDER_SIZE = 64


def _style_labels() -> list[str]:
    labels = []
    for sid in core.style_ids():
        s = core.load_index()["styles"][sid]
        labels.append(f"{sid}{SEP}{s['generation_name']}")
    return labels


def _id_from_label(label: str) -> str:
    """'FA-001 · Xxx' -> 'FA-001'；也接受裸编号。"""
    if not label:
        return ""
    head = label.split(SEP)[0].strip()
    table = core.load_index()["styles"]
    if head in table:
        return head
    if label in table:
        return label
    return head


def _blank_image() -> torch.Tensor:
    arr = np.full((PLACEHOLDER_SIZE, PLACEHOLDER_SIZE, 3), 0.5, dtype=np.float32)
    return torch.from_numpy(arr)[None,]


def _load_image(path: str | None) -> torch.Tensor:
    if not path or not os.path.isfile(path):
        return _blank_image()
    img = Image.open(path)
    img.load()
    arr = np.array(img.convert("RGB"), dtype=np.float32) / 255.0
    return torch.from_numpy(arr)[None,]


class VisualStyleNode:
    """风格类别图库：选一个风格，输出该参考图与拼好的提示词。"""

    @classmethod
    def INPUT_TYPES(cls):
        styles = _style_labels()
        return {
            "required": {
                "style": (styles, {"default": styles[0] if styles else ""}),
                "theme": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "placeholder": "手写画面主题，例如：秋天的第一杯奶茶",
                    "tooltip": "你写主题，节点负责补风格类别",
                }),
            },
            "optional": {
                "language": (["auto", "zh", "en"], {"default": "auto"}),
                "include_traits": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "是否把风格的核心特征写进提示词（知名纯风格可关掉，避免稀释）",
                }),
            },
        }

    RETURN_TYPES = ("IMAGE", "STRING", "STRING")
    RETURN_NAMES = ("image", "prompt", "summary")
    FUNCTION = "render"
    CATEGORY = "Visual Style"
    DESCRIPTION = (
        "风格类别图库：369 种风格分 9 大类。"
        "点「打开图库」按分类选图；image 输出所选参考图，"
        "prompt 输出「风格类别 + 主题」一条提示词。"
    )

    @classmethod
    def IS_CHANGED(cls, style="", theme="", language="auto", include_traits=True, **kwargs):
        return f"{style}|{theme}|{language}|{include_traits}"

    def render(self, style, theme, language="auto", include_traits=True):
        style_id = _id_from_label(style)

        result = core.build_prompt(
            style=style_id,
            theme=theme or "",
            language=language,
            include_traits=include_traits,
        )

        image = _load_image(core.asset_path(style_id))

        summary = f"风格类别：{result['style_name'] or '未选'}"

        return (image, result["prompt"], summary)


NODE_CLASS_MAPPINGS = {
    "VisualStyleNode": VisualStyleNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "VisualStyleNode": "Visual Style 风格类别",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
