package com.chuanzi.app.handler;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;

public class RootHandler implements HttpHandler {
    private final ApiHandler apiHandler;
    private final StaticFileHandler staticFileHandler;

    public RootHandler(ApiHandler apiHandler, StaticFileHandler staticFileHandler) {
        this.apiHandler = apiHandler;
        this.staticFileHandler = staticFileHandler;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        if (path.startsWith("/api/")) {
            apiHandler.handle(exchange);
            return;
        }
        staticFileHandler.handle(exchange);
    }
}
