# docx-tmpl 提供一个Word文档(.docx)文件生成服务

## 开发指南

本服务基于[easy-template-x]文档模板功能，使用[Bun]作为运行时并编译成独立的可执行文件；

## 依赖说明

- `easy-template-x` 为 [qingtao/easy-template-x]（上游 [alonrbar/easy-template-x] 的 fork，包含接受`base64`字符串的图片内容的修改）的构建产物，已 **vendoring 在仓库的 `vendor/easy-template-x/` 目录**（含 `dist/` 构建产物与 `index.mts` 再导出模块），无需从任何仓库下载。
- 其余 npm 依赖（`easy-template-x-angular-expressions` 及其传递依赖 `@xmldom/xmldom`、`jszip`、`lodash.get`、`json5`）由 Bun 从 **公共 npm 源** 解析，统一在 `package.json` 中声明，并由 `bun.lock` 锁定，**不再依赖内部私有仓库**。
- `easy-template-x` 通过 `file:./vendor/easy-template-x` 与 `overrides` 引入，保证 `easy-template-x-angular-expressions` 也使用同一份 vendored 构建产物。
- 首次运行/编译前先安装依赖：

```bash
bun install
```

## 运行

```bash
bun run dev
```

## 编译打包

```bash
# 编译（静态资源 public/ 会随 --asset ./public 嵌入二进制）
bun run build:prod
# linux/arm64
bun run build:linux:arm64
# linux/amd64
bun run build:linux:amd64
# darwin/arm64
bun run build:darwin:arm64
```

编译成功后在 dist 目录下生成 `docx-tmpl` 文件

> 注意：Bun 编译的 Linux 可执行文件默认依赖 glibc，若目标环境是 Alpine 等 musl 发行版，请改用 musl 目标，例如：
>
> ```bash
> bun build --compile --asset ./public --target=bun-linux-x64-musl --outfile dist/docx-tmpl-musl index.ts
> ```

### 一键发布

编译全部平台并打包到 `release/`（压缩包内只含可执行文件，同时生成 `sha256sum.txt`）：

```bash
./release.sh                  # 全部平台
./release.sh linux-amd64      # 只打包指定平台
```

## 备注

### 更新 vendored 依赖

`easy-template-x` 以源码构建产物形式 vendoring 在仓库内，fork 有更新时需手动重新构建并同步：

```bash
# 在 fork 仓库中
yarn install && yarn build
# 将新生成的 dist/ 复制覆盖到本项目的 vendor/easy-template-x/dist/
cp -r <fork>/dist/* vendor/easy-template-x/dist/
```

其余 npm 依赖版本统一在 `package.json` 的 `dependencies` 中管理，如需升级直接修改对应版本号后重新 `bun install` 即可。

### 编辑器（VSCode）

建议安装官方 Bun 扩展（`oven.bun-vscode`），它提供 Bun API 的补全与运行支持；类型声明来自 `@types/bun`（由 `tsconfig.json` 的 `types: ["bun"]` 引入）。
若编辑器中出现 “找不到名称 Bun” / “找不到模块 easy-template-x” 等类型报错，多为依赖未安装或 TS 语言服务未刷新，可先 `bun install` 再重载窗口。可用 `bun run check`（即 `tsc --noEmit`）在命令行验证，通过即代表代码本身无误。

## 运行服务

```bash
./docx-tmpl
```

可以指定监听的端口号，例如:

```bash
PORT=8080 ./docx-tmpl
```

## API

接口采用 UTF-8 编码，请求参数为 json 格式。

### 1. 请求生成文档

- 请求路径: `/api/docx`
- 请求方式: `POST`
- 请求参数: `application/json`

| 参数名称       | 参数类型 | 是否必填 | 参数描述                                                                                                    |
| :------------- | :------- | :------- | :---------------------------------------------------------------------------------------------------------- |
| template_url   | string   | 是       | 模板文件地址, 必须以 `http://` 或 `https://` 开头                                                           |
| data           | object   | 是       | 文档数据, 必须是与模板变量匹配的 json 格式，参数以模板中使用为准                                            |
| output_file    | string   | 是       | 输出文件名，必须以 `.docx` 结尾                                                                             |
| template_token | string   | 否       | 如果非空，服务通过`template_url`请求模板文件时会通过请求头`Authorization: Bearer ${template_token}`发送令牌 |

- 请求示例:

```json
{
    "template_url": "{{HOST}}/files/sample.docx",
    "data": {
        "name": "John Doe",
        "age": 30,
        "address": " Main St",
        "profile_image": {
          "_type": "image",
          "format": "image/png",
          "source": "data:image/png;base64,iV..."
        }
    },
    "output_file": "output导出文件.docx",
    "template_token": "TOKEN"
}
```


- 成功返回: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

成功时返回文档附件, 可以按照附件下载，参考 [sample.html](public/sample.html)

- 失败返回: `application/json`

| 参数名称       | 类型   | 非空 | 说明                                         |
| :------------- | :----- | :--- | :------------------------------------------- |
| code           | int    | 是   | 错误码                                       |
| message        | string | 是   | 错误信息                                     |
| template_error | string | 否   | 获取模板时的错误信息, 由提供模板的服务器返回 |

示例:

  ```json
  {
    "code": 500,
    "message": "获取模板文件失败",
    "template_error": "{\"code\":400,\"message\":\"示例模板文件不正确\"}"
  }
  ```

### 2. 演示页

默认端口时打开`http://localhost:8080/example`查看示例。

### 3. 使用帮助

模板法参考 [easy-template-x]

[bun]: https://bun.com/docs
[easy-template-x]: https://github.com/qingtao/easy-template-x
[alonrbar/easy-template-x]: https://github.com/alonrbar/easy-template-x

### 4. 注意事项


- 我们修改了`delimiters`中有关tag选项的分隔符

```js
   const handler = new TemplateHandler({
        scopeDataResolver: createResolver(),
        delimiters: {
          // 默认时是'['
            tagOptionsStart: '[[',
          // 默认时是']'
            tagOptionsEnd: ']]'
        }

    });
```