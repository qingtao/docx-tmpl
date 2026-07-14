///
import { type TemplateData, TemplateHandler } from "easy-template-x";
import { createResolver } from "easy-template-x-angular-expressions";

const publicURL = (file: string) =>
  new URL("./public/" + file, import.meta.url);

// serveStatic 以流式方式返回 public 目录下的静态文件，并显式设置 Content-Type
const serveStatic = async (path: string, contentType: string) => {
  try {
    const file = await Deno.open(publicURL(path), { read: true });
    return new Response(file.readable, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return error_response({ code: 404, message: "文件不存在" });
  }
};

const port = Number(Deno.env.get("PORT") ?? "8080");
let activeRequests = 0;

const _server = Deno.serve({ port, onError }, async (req: Request) => {
  activeRequests++;
  try {
    return await route(req);
  } finally {
    activeRequests--;
  }
});

function onError(error: unknown) {
  const err = error as Error;
  console.warn("[WARN] 请求发生错误", err?.message, err?.cause);
  return error_response({
    code: 500,
    message: err?.message,
    template_error: err?.cause,
  });
}

const docx_cors = (_req: Request) => {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Access-Control-Allow-Headers": "*",
    },
  });
};

// DocxRequest 请求生成文档的参数
interface docx_request {
  // 模板文件的地址
  template_url: string;
  // 数据字段
  data: TemplateData;
  // 输出文件名
  output_file: string;
  // 令牌， 请求文件时使用 Authorization: Bearer ${token}头部和template_url指定的文件地址
  template_token?: string;
}

interface api_response {
  code: number;
  message: string;
  template_error?: unknown;
}

const not_found = () => {
  return error_response({
    code: 404,
    message: "Not Found",
  });
};

const error_response = (res: api_response) => {
  let status = 200;
  if (
    (res?.code >= 400 && res?.code < 500) ||
    (res?.code >= 500 && res?.code < 600)
  ) {
    status = res.code;
  }
  const resp = new Response(JSON.stringify(res), {
    status: status,
    headers: {
      "Content-Type": "application/json",
    },
  });
  return resp;
};

const get_template_file = (url: string, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, {
    headers,
  }).then(async (res) => {
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`获取模板文件失败`, {
        cause: txt,
      });
    }
    return res.arrayBuffer();
  });
};

// 正则表达式匹配sample.doc[x]
const docRe = new RegExp(".+/files/(.*\\.docx?|.*\\.png)");

// send_template_file 测试文件
const send_template_file = (req: Request) => {
  const filename = req.url.replace(docRe, "$1");
  if (!filename || filename === req.url) {
    return error_response({
      code: 400,
      message: "示例模板文件不正确",
    });
  }
  switch (filename) {
    case "sample.docx":
      return serveStatic(
        "sample.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    case "advanced.docx":
      return serveStatic(
        "advanced.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    case "sample.png":
      return serveStatic("profile.png", "image/png");
  }
  return error_response({
    code: 404,
    message: "文件不存在",
  });
};

// handleDocx 处理生成docx文档的请求, 如果成功将返回文件流，失败返回错误信息
const handleDocx = async (req: Request) => {
  const args = await req.json() as docx_request;
  if (
    !args.template_url ||
    (!args.template_url.startsWith("http://") &&
      !args.template_url.startsWith("https://"))
  ) {
    return error_response({
      code: 400,
      message: "参数template_url无效, 必须提供有效的模板URL",
    });
  }
  if (!args.data) {
    return error_response({
      code: 400,
      message: "参数data无效, 必须提供有效的JSON格式数据",
    });
  }
  if (!args.output_file || !args.output_file.endsWith(".docx")) {
    return error_response({
      code: 400,
      message: "参数output_file无效, 必须提供有效的文件名, 以.docx结尾",
    });
  }

  const templateFile = await get_template_file(
    args.template_url,
    args.template_token,
  );

  const handler = new TemplateHandler({
    // @ts-ignore 可能是替换easy-template-x包的问题，不影响使用，暂时先忽略
    scopeDataResolver: createResolver(),
    delimiters: {
      tagOptionsStart: "[[",
      tagOptionsEnd: "]]",
    },
  });
  const doc = await handler.process(templateFile, args.data);
  return new Response(doc, {
    headers: {
      "Origin": req.headers.get("host") || "*",
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${
        encodeURIComponent(args.output_file)
      }`,
    },
  });
};

const metrics = () => {
  return new Response(
    `server_port: ${port}\n` +
      `server_active_requests: ${activeRequests}\n`,
  );
};

const route = (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/metrics" && req.method === "GET") {
    return metrics();
  }
  if (path === "/api/status") {
    return new Response("OK");
  }
  if (path === "/api/docx") {
    if (req.method === "OPTIONS") {
      return docx_cors(req);
    }
    if (req.method === "POST") {
      return handleDocx(req);
    }
    return new Response(null, { status: 405 });
  }
  if (path.startsWith("/files/")) {
    return send_template_file(req);
  }
  if (path === "/example/sample") {
    return serveStatic("sample.html", "text/html; charset=utf-8");
  }
  if (path === "/example/advanced") {
    return serveStatic("advanced.html", "text/html; charset=utf-8");
  }
  if (path === "/example") {
    return serveStatic("index.html", "text/html; charset=utf-8");
  }
  return not_found();
};

console.info(`Listening on port http://localhost:${port}`);
console.info(`See http://localhost:${port}/example`);
