$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
docker run --rm --network none --mount "type=bind,source=$taskRoot,target=/workspace" --workdir /workspace node:24-bookworm-slim node scripts/setup.mjs
if ($LASTEXITCODE -ne 0) { throw 'Falha na preparação do laboratório.' }
