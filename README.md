# docx-tmpl 提供一个Word文档(.docx)文件生成服务

## 开发指南

本服务基于[easy-template-x]文档模板功能，使用[Deno]编译成独立的可执行文件；

## 依赖说明

- `easy-template-x` 为 [qingtao/easy-template-x]（上游 [alonrbar/easy-template-x] 的 fork，含我们的修改）的构建产物，已 **vendoring 在仓库的 `vendor/easy-template-x/` 目录**（含 `dist/` 构建产物与 `index.mts` 再导出模块），无需从任何仓库下载。
- 其余 npm 依赖（`easy-template-x-angular-expressions` 及其传递依赖 `@xmldom/xmldom`、`jszip`、`lodash.get`、`json5`）由 Deno 从 **公共 npm 源** 解析，通过 `deno.json` 的 `imports` 与 `nodeModulesDir: auto` 管理，**不再依赖内部私有仓库**。
- 首次运行/编译时 Deno 会自动拉取并缓存依赖；也可手动预拉取：

```bash
deno cache index.ts
```

## 运行

```bash
deno task dev
```

## 编译打包

```bash
# 编译（静态资源 public/ 会随 --include 嵌入二进制）
deno task build:prod
# linux/arm64
deno task build:linux:arm64
# linux/amd64
deno task build:linux:amd64
# darwin/arm64
deno task build:darwin:arm64
```

编译成功后在 dist 目录下生成 `docx-tmpl` 文件

## 备注

### 更新 vendored 依赖

`easy-template-x` 以源码构建产物形式 vendoring 在仓库内，fork 有更新时需手动重新构建并同步：

```bash
# 在 fork 仓库中
yarn install && yarn build
# 将新生成的 dist/ 复制覆盖到本项目的 vendor/easy-template-x/dist/
cp -r <fork>/dist/* vendor/easy-template-x/dist/
```

其余 npm 依赖版本统一在 `deno.json` 的 `imports` 中管理，如需升级直接修改对应版本号即可。

### 编辑器（VSCode）

建议使用官方 Deno 扩展（`denoland.vscode-deno`），它会读取 `deno.json` 的 `imports` 映射与 `deno.ns` 类型。
若编辑器中出现 “找不到名称 Deno” / “找不到模块 easy-template-x” 等类型报错，说明 Deno 语言服务未接管 `.ts` 文件：请重载 Deno 语言服务（命令面板执行 `Deno: Reload Language Server`），并禁用会抢占 `.ts` 检查的实验性 TypeScript 插件（如 tsgo 预览版）。可用 `deno check index.ts` / `deno lint index.ts` 在命令行验证，二者通过即代表代码本身无误。

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
        "address": " Main St"
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

[deno]: https://deno.com
[easy-template-x]: https://github.com/qingtao/easy-template-x
[alonrbar/easy-template-x]: https://github.com/alonrbar/easy-template-x

### 4. 注意事项


- 我们修改了`delimiters`中有关tag选项的分隔符

```js
   const handler = new TemplateHandler({
        // @ts-ignore 可能是替换easy-template-x包的问题，不影响使用，暂时先忽略
        scopeDataResolver: createResolver(),
        delimiters: {
          // 默认时是'['
            tagOptionsStart: '[[',
          // 默认时是']'
            tagOptionsEnd: ']]'
        }

    });
```