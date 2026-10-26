#!/usr/bin/env bash
#
# 编译各平台可执行文件并打包发布到 release/
#
# 用法:
#   ./release.sh                # 编译并打包全部平台
#   ./release.sh linux-amd64    # 只编译打包指定平台（可传多个）
#
set -euo pipefail

cd "$(dirname "$0")"

dist_dir="dist"
release_dir="release"

# 平台清单: "<产物后缀> <package.json 中的构建脚本>"
targets=(
    "linux-amd64 build:linux:amd64"
    "linux-arm64 build:linux:arm64"
    "darwin-arm64 build:darwin:arm64"
)

# bun 可能安装在 ~/.bun/bin 而未加入 PATH
if ! command -v bun >/dev/null 2>&1; then
    export PATH="${HOME}/.bun/bin:${PATH}"
fi
if ! command -v bun >/dev/null 2>&1; then
    echo "错误: 未找到 bun，请先安装 https://bun.com/docs" >&2
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "==> 安装依赖"
    bun install
fi

# 校验并筛选要编译的平台
requested=("$@")
selected=()
if [ ${#requested[@]} -eq 0 ]; then
    selected=("${targets[@]}")
else
    for entry in "${targets[@]}"; do
        suffix="${entry%% *}"
        for want in "${requested[@]}"; do
            if [ "${want}" = "${suffix}" ]; then
                selected+=("${entry}")
            fi
        done
    done
    if [ ${#selected[@]} -eq 0 ]; then
        echo "错误: 不支持的平台: ${requested[*]}" >&2
        echo "可选: linux-amd64 linux-arm64 darwin-arm64" >&2
        exit 1
    fi
fi

mkdir -p "${dist_dir}" "${release_dir}"

# 清理上一次的产物，避免旧版本被打包（保留 dist/.gitkeep）
rm -f "${dist_dir}"/docx-tmpl "${dist_dir}"/docx-tmpl-*
rm -f "${release_dir}"/*.tar.gz "${release_dir}"/sha256sum.txt

for entry in "${selected[@]}"; do
    suffix="${entry%% *}"
    script="${entry##* }"
    name="docx-tmpl-${suffix}"

    echo "==> 编译 ${name}（bun run ${script}）"
    bun run "${script}"

    if [ ! -f "${dist_dir}/${name}" ]; then
        echo "错误: ${name} 编译失败" >&2
        exit 1
    fi

    echo "==> 打包 ${release_dir}/${name}.tar.gz"
    # -C 进入 dist 目录，使压缩包内只包含可执行文件本身
    tar -czf "${release_dir}/${name}.tar.gz" -C "${dist_dir}" "${name}"
done

# 生成校验文件（只写文件名，可在 release 目录内直接 sha256sum -c sha256sum.txt）
(
    cd "${release_dir}"
    sha256sum ./*.tar.gz | sed 's| \./| |' > sha256sum.txt
)

echo "==> 打包完成"
ls -lh "${release_dir}"
cat "${release_dir}/sha256sum.txt"
