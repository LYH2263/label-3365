package com.chuanzi.app.handler;

import com.chuanzi.app.infra.HttpUtil;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

public class StaticFileHandler implements HttpHandler {
    private static final Map<String, String> CONTENT_TYPE_MAP = Map.of(
        "html", "text/html; charset=utf-8",
        "css", "text/css; charset=utf-8",
        "js", "application/javascript; charset=utf-8",
        "json", "application/json; charset=utf-8",
        "png", "image/png",
        "jpg", "image/jpeg",
        "jpeg", "image/jpeg",
        "svg", "image/svg+xml"
    );

    private final Path webRoot;

    public StaticFileHandler(Path webRoot) {
        this.webRoot = webRoot.normalize().toAbsolutePath();
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        if (!"GET".equals(method) && !"HEAD".equals(method)) {
            HttpUtil.sendText(
                exchange,
                405,
                "text/plain; charset=utf-8",
                "Method Not Allowed".getBytes(StandardCharsets.UTF_8)
            );
            return;
        }

        String path = exchange.getRequestURI().getPath();
        if ("/".equals(path)) {
            HttpUtil.redirect(exchange, "/login.html");
            return;
        }

        Path candidate = webRoot.resolve(path.substring(1)).normalize().toAbsolutePath();
        if (!candidate.startsWith(webRoot) || !Files.exists(candidate) || Files.isDirectory(candidate)) {
            HttpUtil.sendText(exchange, 404, "text/plain; charset=utf-8", "Not Found".getBytes(StandardCharsets.UTF_8));
            return;
        }

        String contentType = guessContentType(candidate);
        byte[] content = HttpUtil.readFileBytes(candidate);
        if ("HEAD".equals(method)) {
            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
            return;
        }
        HttpUtil.sendText(exchange, 200, contentType, content);
    }

    private String guessContentType(Path path) {
        String fileName = path.getFileName().toString();
        int idx = fileName.lastIndexOf('.');
        if (idx <= 0 || idx == fileName.length() - 1) {
            return "application/octet-stream";
        }
        String ext = fileName.substring(idx + 1).toLowerCase();
        return CONTENT_TYPE_MAP.getOrDefault(ext, "application/octet-stream");
    }
}
