#!/usr/bin/env bash
# Installs TRELLIS (microsoft/TRELLIS, image-large) into an isolated uv env outside the repo.
# Tested on Quadro RTX 8000 (sm_75), system nvcc 12.0, gcc-12.
set -euo pipefail
ROOT="${IMAGE_TO_3D_HOME:-$HOME/.local/opt/image-to-3d}"
mkdir -p "$ROOT" && cd "$ROOT"
export CUDA_HOME=/usr CC=gcc-12 CXX=g++-12 TORCH_CUDA_ARCH_LIST="7.5" MAX_JOBS=16
[ -d TRELLIS ] || git clone --recurse-submodules https://github.com/microsoft/TRELLIS.git
cd TRELLIS
[ -d .venv ] || uv venv --python 3.10 .venv
source .venv/bin/activate
uv pip install torch==2.4.0 torchvision==0.19.0 --index-url https://download.pytorch.org/whl/cu121
uv pip install xformers==0.0.27.post2 --index-url https://download.pytorch.org/whl/cu121
uv pip install pillow imageio imageio-ffmpeg tqdm easydict opencv-python-headless scipy ninja \
  "rembg[gpu]" onnxruntime trimesh open3d xatlas pyvista pymeshfix igraph "transformers<4.50" \
  "numpy<2" spconv-cu120 setuptools wheel huggingface_hub safetensors
uv pip install "git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8"
uv pip install kaolin==0.17.0 -f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.4.0_cu121.html
mkdir -p ext && cd ext
[ -d nvdiffrast ] || git clone https://github.com/NVlabs/nvdiffrast.git
[ -d diffoctreerast ] || git clone --recurse-submodules https://github.com/JeffreyXiang/diffoctreerast.git
[ -d mip-splatting ] || git clone https://github.com/autonomousvision/mip-splatting.git
uv pip install --no-build-isolation ./nvdiffrast
uv pip install --no-build-isolation ./diffoctreerast
uv pip install --no-build-isolation ./mip-splatting/submodules/diff-gaussian-rasterization
python -c "import torch, xformers, kaolin, nvdiffrast.torch, spconv, diff_gaussian_rasterization; print('trellis env ok', torch.__version__, torch.cuda.is_available())"
