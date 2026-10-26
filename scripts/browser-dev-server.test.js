"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { rewriteText } = require("./browser-dev-server.js");

test("rewrites player page URLs to the upstream YouTube origin", () => {
    const source = [
        "this.url=document.location.toString();",
        "this.referer=document.location.href;"
    ].join("");

    const rewritten = rewriteText(source, "application/javascript", "/s/player/test/tv-player.js");

    assert.match(rewritten, /document\.location\.toString\(\)\.replace\("http:\/\/localhost:8099","https:\/\/www\.youtube\.com"\)/);
    assert.match(rewritten, /document\.location\.href\.replace\("http:\/\/localhost:8099","https:\/\/www\.youtube\.com"\)/);
});

test("continues to proxy media URLs after applying the origin rewrite", () => {
    const source = '"https://r1---sn.test.googlevideo.com/videoplayback"';
    const rewritten = rewriteText(source, "application/json", "/youtubei/v1/player");

    assert.equal(
        rewritten,
        '"http://localhost:8099/cors-bypass/https://r1---sn.test.googlevideo.com/videoplayback"'
    );
});

test("keeps the desktop browser user agent visible to YouTube's compatibility check", () => {
    const rewritten = rewriteText("<html><head></head><body></body></html>", "text/html", "/tv");

    assert.doesNotMatch(rewritten, /Object\.defineProperty\(navigator,"userAgent"/);
    assert.match(rewritten, /<script src="\/__tizentube\/userScript\.js"><\/script>/);
});
