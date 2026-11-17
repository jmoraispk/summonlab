# License and pricing findings (checked 2026-11-16)

Sources were read from primary pages where reachable; "unverified" marks claims from search snippets
because the primary page blocked automated fetching.

## TRELLIS (local)
- Code: MIT — https://raw.githubusercontent.com/microsoft/TRELLIS/main/LICENSE
- Weights `microsoft/TRELLIS-image-large`: MIT — https://huggingface.co/microsoft/TRELLIS-image-large
- **GLB export dependencies are non-commercial:** `postprocessing_utils.to_glb()` renders the Gaussians with
  `diff_gaussian_rasterization` (Inria Gaussian-Splatting License, research/non-commercial only —
  https://raw.githubusercontent.com/autonomousvision/mip-splatting/main/submodules/diff-gaussian-rasterization/LICENSE.md)
  and bakes with `nvdiffrast` (NVIDIA Source Code License, non-commercial "research or evaluation" only —
  https://raw.githubusercontent.com/NVlabs/nvdiffrast/main/LICENSE.txt). `diffoctreerast` (installed, not on the GLB path) is
  also Inria-derived non-commercial — https://raw.githubusercontent.com/JeffreyXiang/diffoctreerast/master/LICENSE
- Permissive deps: kaolin Apache-2.0, FlexiCubes Apache-2.0, utils3d MIT.
- Takeaway: model is MIT, but production use needs the bake path swapped (e.g. gsplat, Apache-2.0, not checked) or licenses
  from Inria/NVIDIA.

## Hunyuan3D-2 (local)
- Tencent Hunyuan 3D 2.0 Community License — https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2/main/LICENSE
- Territory excludes the EU, UK and South Korea, and the restriction covers Outputs used or displayed outside the Territory.
- Over 1M MAU at release date requires a separate Tencent license.
- "Tencent claims no rights in Outputs"; outputs may not be used to improve other AI models. Acceptable Use Policy applies.
- The texture path uses Tencent's own `custom_rasterizer` (same license), not nvdiffrast.

## Meshy (hosted, not run)
- API: image-to-3D 20 credits mesh-only, 30 textured; auto-rig 5 credits; animation 3 credits/action —
  https://docs.meshy.ai/en/api/pricing. API needs a paid plan — https://docs.meshy.ai/en/api/quick-start
- USD (unverified): Pro ≈ $20 / 1,000 credits → ≈ $0.60 textured model, ≈ $0.28 rig + 3 animations.
- Outputs: free tier CC BY 4.0 owned by Meshy; paid tiers customer-owned, commercial use allowed — https://www.meshy.ai/terms-of-use

## Tripo (hosted, not run)
- Pay-as-you-go, 1 credit = $0.01: image-to-3D 30 credits textured ($0.30), HD texture +10, smart low-poly +10;
  auto-rig 25 ($0.25); animation retarget 10 ($0.10) each — https://developers.tripo3d.ai/en/pricing
- Outputs (unverified): free users CC BY 4.0, paid users hold usage rights — https://www.tripo3d.ai/terms . Confirm that
  API pay-as-you-go counts as "paid".

## Hyper3D Rodin (hosted, not run)
- API only on Business ($120/mo) or Enterprise — https://hyper3d.ai/features/api ; ≈ 0.5 credit/generation, $1.5/credit
  direct (≈ $0.75; ≈ $0.29/model inside Business quota) — https://hyper3d.ai/pricing?lang=en
- Outputs: no limit on use of Rodin output; Deemos may use outputs to improve services — https://hyper3d.ai/legal/terms
- Rigging API: unverified.

## Background removal
- BiRefNet MIT — https://raw.githubusercontent.com/ZhengPeng7/BiRefNet/main/LICENSE ; rembg MIT —
  https://raw.githubusercontent.com/danielgatis/rembg/main/LICENSE.txt
