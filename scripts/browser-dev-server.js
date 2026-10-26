"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const userscriptPath = path.join(projectRoot, "dist", "userScript.js");
const host = process.env.TIZENTUBE_DEV_HOST || "127.0.0.1";
const port = Number(process.env.TIZENTUBE_DEV_PORT || 8099);
const publicOrigin = `http://localhost:${port}`;
const openBrowser = process.argv.includes("--open");
const tvUserAgent = process.env.TIZENTUBE_DEV_USER_AGENT ||
    "Mozilla/5.0 (Linux armv7l; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Version/6.0 TV Safari/537.36 SmartTV/6.0";
const iconFontUrl = "https://www.gstatic.com/ytlr/fonts/YouTubeIconsOutlinedExperimental-Regular-v154.ttf";
const youtubeOrigin = "https://www.youtube.com";

const textTypes = [
    "text/html",
    "text/css",
    "javascript",
    "application/json",
    "application/xml",
    "text/xml"
];

function isTextResponse(contentType) {
    return textTypes.some(type => contentType.includes(type));
}

function upstreamUrl(requestUrl) {
    const bypassPrefix = "/cors-bypass/";
    if (requestUrl.startsWith(bypassPrefix)) {
        const value = requestUrl.slice(bypassPrefix.length);
        return new URL(value.startsWith("http") ? value : `https://${value}`);
    }

    return new URL(requestUrl, "https://www.youtube.com");
}

function localizeUrl(value) {
    if (!value) return value;

    try {
        const target = new URL(value, "https://www.youtube.com");
        if (target.hostname === "youtube.com" || target.hostname === "www.youtube.com") {
            return `${publicOrigin}${target.pathname}${target.search}${target.hash}`;
        }
    } catch (_) {
        // Leave malformed and non-URL header values untouched.
    }

    return value;
}

function rewriteText(text, contentType, requestUrl) {
    const proxyPrefix = `${publicOrigin}/cors-bypass/`;
    const upstreamLocation = `.replace(${JSON.stringify(publicOrigin)},${JSON.stringify(youtubeOrigin)})`;

    text = text
        .replace(/https:\/\/([a-zA-Z0-9.-]+)\.googlevideo\.com/g, `${proxyPrefix}https://$1.googlevideo.com`)
        .replace(/https:\\\/\\\/([a-zA-Z0-9.-]+)\.googlevideo\.com/g, `${publicOrigin.replaceAll("/", "\\/")}\\/cors-bypass\\/https:\\/\\/$1.googlevideo.com`)
        .replace(/"\/\/([a-zA-Z0-9.-]+)\.googlevideo\.com/g, `"${proxyPrefix}https://$1.googlevideo.com`)
        .replace(/https:\/\/(www\.gstatic\.com|yt3\.ggpht\.com|clients1\.google\.com|s\.youtube\.com|jnn-pa\.googleapis\.com|yt3\.googleusercontent\.com)/g, `${proxyPrefix}https://$1`)
        .replace(/http:\/\/(www\.gstatic\.com|clients1\.google\.com)/g, `${proxyPrefix}https://$1`)
        .replace(/"\/\/(www\.gstatic\.com|clients1\.google\.com|yt3\.googleusercontent\.com)/g, `"${proxyPrefix}https://$1`)
        .replace(/https:\/\/redirector\.googlevideo\.com/g, `${proxyPrefix}https://redirector.googlevideo.com`)
        // YouTube's player includes the page URL in playback requests. Sending the
        // proxy origin makes the TV client fail with "NO DEBUG ACCESS DOMAIN=localhost".
        .replace(/document\.location\.toString\(\)/g, `document.location.toString()${upstreamLocation}`)
        .replace(/document\.location\.href/g, `document.location.href${upstreamLocation}`);

    if (contentType.includes("text/html")) {
        text = text.replace(
            /<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy(?:-Report-Only)?["'][^>]*>/gi,
            ""
        );

        if (requestUrl.startsWith("/tv")) {
            const iconFont = `<style>@font-face{font-family:"YouTube Icons Outlined";src:url("${proxyPrefix}${iconFontUrl}") format("truetype");font-style:normal;font-weight:400;font-display:block}</style>`;
            const loader = `${iconFont}<script src="/__tizentube/userScript.js"></script>`;
            text = text.includes("</body>") ? text.replace("</body>", `${loader}</body>`) : `${text}${loader}`;
        }
    }

    return text;
}

function copyResponseHeaders(upstreamHeaders, response, target) {
    const skipped = new Set([
        "content-encoding",
        "content-length",
        "transfer-encoding",
        "content-security-policy",
        "content-security-policy-report-only",
        "strict-transport-security",
        "alt-svc",
        "connection"
    ]);

    for (const [name, rawValue] of Object.entries(upstreamHeaders)) {
        if (skipped.has(name.toLowerCase()) || rawValue === undefined) continue;

        if (name.toLowerCase() === "set-cookie") {
            const cookies = (Array.isArray(rawValue) ? rawValue : [rawValue]).map(cookie => cookie
                .replace(/^__Secure-/i, "__LocalSecure-")
                .replace(/^__Host-/i, "__LocalHost-")
                .replace(/;\s*Domain=[^;]+/ig, "")
                .replace(/;\s*Secure/ig, "")
                .replace(/;\s*SameSite=None/ig, "; SameSite=Lax"));
            response.setHeader(name, cookies);
            continue;
        }

        if (name.toLowerCase() === "location") {
            response.setHeader(name, localizeUrl(Array.isArray(rawValue) ? rawValue[0] : rawValue));
            continue;
        }

        response.setHeader(name, rawValue);
    }

    response.setHeader("Access-Control-Allow-Origin", publicOrigin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    response.setHeader("X-TizenTube-Upstream", target.host);
}

function serveLocal(request, response) {
    if (request.url === "/__tizentube/health") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true, port, userscript: fs.existsSync(userscriptPath) }));
        return true;
    }

    if (request.url === "/__tizentube/userScript.js") {
        if (!fs.existsSync(userscriptPath)) {
            response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("dist/userScript.js is missing. Run npm run build first.");
            return true;
        }

        response.writeHead(200, {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "no-store"
        });
        fs.createReadStream(userscriptPath).pipe(response);
        return true;
    }

    return false;
}

function proxy(request, response) {
    let target;
    try {
        target = upstreamUrl(request.url);
    } catch (error) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(`Invalid proxy URL: ${error.message}`);
        return;
    }

    const headers = { ...request.headers };
    headers.host = target.host;
    headers["user-agent"] = tvUserAgent;
    headers.origin = "https://www.youtube.com";
    headers.referer = "https://www.youtube.com/tv";
    headers["accept-encoding"] = "identity";
    delete headers.connection;
    delete headers["content-length"];

    if (headers.cookie) {
        headers.cookie = headers.cookie
            .replace(/__LocalSecure-/g, "__Secure-")
            .replace(/__LocalHost-/g, "__Host-");
    }

    const transport = target.protocol === "http:" ? http : https;
    const upstream = transport.request({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        method: request.method,
        path: `${target.pathname}${target.search}`,
        headers,
        maxHeaderSize: 1024 * 1024
    }, upstreamResponse => {
        const contentType = upstreamResponse.headers["content-type"] || "";
        copyResponseHeaders(upstreamResponse.headers, response, target);
        response.statusCode = upstreamResponse.statusCode || 502;

        if (!isTextResponse(contentType)) {
            upstreamResponse.pipe(response);
            return;
        }

        const chunks = [];
        upstreamResponse.on("data", chunk => chunks.push(chunk));
        upstreamResponse.on("end", () => {
            const body = rewriteText(Buffer.concat(chunks).toString("utf8"), contentType, request.url);
            response.setHeader("Content-Length", Buffer.byteLength(body));
            response.end(body);
        });
    });

    upstream.on("error", error => {
        if (response.headersSent) return response.destroy(error);
        response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(`TizenTube development proxy could not reach ${target.host}: ${error.message}`);
    });

    request.pipe(upstream);
}

function launch(url) {
    const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
}

function createServer() {
    return http.createServer((request, response) => {
        if (request.method === "OPTIONS") {
            response.writeHead(204, {
                "Access-Control-Allow-Origin": publicOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": request.headers["access-control-request-headers"] || "*"
            });
            return response.end();
        }

        if (serveLocal(request, response)) return;
        proxy(request, response);
    });
}

if (require.main === module) {
    const server = createServer();

    server.listen(port, host, () => {
        const url = `${publicOrigin}/tv?additionalDataUrl=${encodeURIComponent(`${publicOrigin}/dial/apps/YouTube`)}`;
        console.log(`TizenTube browser test is running at:\n${url}`);
        console.log("Press Ctrl+C to stop it.");
        if (openBrowser) launch(url);
    });

    server.on("error", error => {
        if (error.code === "EADDRINUSE") {
            console.error(`Port ${port} is already in use. Set TIZENTUBE_DEV_PORT to another port.`);
        } else {
            console.error(error);
        }
        process.exitCode = 1;
    });
}

module.exports = { rewriteText, createServer };
