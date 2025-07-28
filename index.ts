import { TemplateHandler, type TemplateData } from 'easy-template-x';
import { createResolver } from "easy-template-x-angular-expressions";
import sample_docx from './public/sample.docx' with  { type: 'file' };
import advanced_docx from './public/advanced.docx' with  { type: 'file' };
import sample_html from './public/sample.html' with  { type: 'file' };
import advanced_html from './public/advanced.html' with  { type: 'file' };
import index_html from './public/index.html' with  { type: 'file' };

const server = Bun.serve({
    port: process.env.PORT || 8080,
    routes: {
        "/metrics": {
            GET: (_req, server) => metrics(server),
        },
        "/api/status": new Response("OK"),
        "/api/docx": {
            POST: (req, server) => handleDocx(req, server),
            OPTIONS: req => docx_cors(req),
        },
        // 固定的返回示例文件
        "/files/*": {
            GET: req => send_template_file(req),
        },
        "/example/sample": {
            GET: req => sample(req),
        },
        "/example/advanced": {
            GET: req => advanced(req),
        },
        "/example": new Response(Bun.file(index_html))
    },
    fetch(_req, _server) {
        return not_found();
    },
    error(error) {
        console.warn("[WARN] 请求发生错误", error.message, error.cause)
        return error_response({
            code: 500,
            message: error.message,
            template_error: error?.cause,
        })
    }
})

const docx_cors = (req: Bun.BunRequest) => {
    return new Response(null, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Max-Age": "86400",
            "Access-Control-Allow-Headers": "*",
        },
    })
}

// 正则表达式匹配sample.doc[x]
const htmlRe = new RegExp('.+/files/(.*\.html?)')

const sample = (req: Bun.BunRequest) => {

    const f = Bun.file(sample_html);
    return new Response(f, {
        status: 200,
        headers: {
            "Content-Type": "text/html",
        },
    });
}


const advanced = (req: Bun.BunRequest) => {
    const f = Bun.file(advanced_html);
    return new Response(f, {
        status: 200,
        headers: {
            "Content-Type": "text/html",
        },
    });
}


// DocxRequest 请求生成文档的参数
interface docx_request {
    // 模板文件的地址
    template_url: string
    // 数据字段
    data: TemplateData;
    // 输出文件名
    output_file: string
    // 令牌， 请求文件时使用 Authorization: Bearer ${token}头部和template_url指定的文件地址
    template_token?: string
}

interface api_response {
    code: number
    message: string
    template_error?: any
}

const not_found = () => {
    return error_response({
        code: 404,
        message: "Not Found"
    })
}

const error_response = (res: api_response) => {
    let status = 200
    if ((res?.code >= 400 && res?.code < 500) || (res?.code >= 500 && res?.code < 600)) {
        status = res.code
    }
    let resp = new Response(JSON.stringify(res), {
        status: status,
        headers: {
            "Content-Type": "application/json"
        }
    })
    return resp
}

const get_template_file = async (url: string, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, {
        headers
    }).then(async (res) => {
        if (!res.ok) {
            const txt = await res.text()
            throw new Error(`获取模板文件失败`, {
                cause: txt,
            })
        }
        return res.arrayBuffer();
    })
}

// 正则表达式匹配sample.doc[x]
const docRe = new RegExp('.+/files/(.*\.docx?)')

// send_sample_file 测试文件
const send_template_file = (req: Bun.BunRequest) => {
    console.log('Authorization', req.headers.get('Authorization'))
    const filename = req.url.replace(docRe, "$1");
    // console.log("filename: ", filename)
    if (!filename || filename === req.url) {
        return error_response({
            code: 400,
            message: "示例模板文件不正确"
        })
    }
    switch (filename) {
        case "sample.docx":
            return new Response(Bun.file(sample_docx));
        case "advanced.docx":
            return new Response(Bun.file(advanced_docx));
    }
    return error_response({
        code: 404,
        message: "文件不存在"
    })
}

// handleDocx 处理生成docx文档的请求, 如果成功将返回文件流，失败返回错误信息
const handleDocx = async (req: Request, server: Bun.Server) => {
    const args = await req.json() as docx_request;
    if (!args.template_url || (!args.template_url.startsWith('http://') && !args.template_url.startsWith('https://'))) {
        return error_response({
            code: 400,
            message: '参数template_url无效, 必须提供有效的模板URL'
        })
    }
    if (!args.data) {
        return error_response({
            code: 400,
            message: '参数data无效, 必须提供有效的JSON格式数据'
        })
    }
    if (!args.output_file || !args.output_file.endsWith('.docx')) {
        return error_response({
            code: 400,
            message: '参数output_file无效, 必须提供有效的文件名, 以.docx结尾'
        })
    }

    const templateFile = await get_template_file(args.template_url, args.template_token)

    const handler = new TemplateHandler({
        scopeDataResolver: createResolver()
    });
    const doc = await handler.process(templateFile, args.data)
    return new Response(doc, {
        headers: {
            "Origin": server.hostname || "*",
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(args.output_file)}`
        }
    });
}

const metrics = (server: Bun.Server) => {
    return new Response(
        `server_port: ${server.port}\n` +
        `server_active_requests: ${server.pendingRequests}\n`
    )
}

console.log(`Listening on port http://${server.hostname}:${server.port}`);