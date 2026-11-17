#!/usr/bin/env bash
# Installs Hunyuan3D-2 (Tencent-Hunyuan/Hunyuan3D-2: shape + paint) into an isolated uv env outside the repo.
set -euo pipefail
ROOT="${IMAGE_TO_3D_HOME:-$HOME/.local/opt/image-to-3d}"
mkdir -p "$ROOT" && cd "$ROOT"
export CUDA_HOME=/usr CC=gcc-12 CXX=g++-12 TORCH_CUDA_ARCH_LIST="7.5" MAX_JOBS=16
[ -d Hunyuan3D-2 ] || git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git
cd Hunyuan3D-2
[ -d .venv ] || uv venv --python 3.10 .venv
source .venv/bin/activate
uv pip install torch==2.4.0 torchvision==0.19.0 --index-url https://download.pytorch.org/whl/cu121
uv pip install -r requirements.txt setuptools wheel pybind11 ninja "numpy<2"
# Pin libraries that otherwise require torch>=2.6 (torch.accelerator).
uv pip install diffusers==0.31.0 transformers==4.46.3 accelerate==1.1.1 "huggingface_hub<0.26"
uv pip install --no-build-isolation -e .
(cd hy3dgen/texgen/custom_rasterizer && uv pip install --no-build-isolation .)
(cd hy3dgen/texgen/differentiable_renderer && uv pip install --no-build-isolation .)
python -c "import torch, custom_rasterizer, hy3dgen; from hy3dgen.texgen.differentiable_renderer import mesh_processor; print('hunyuan env ok', torch.__version__)"
