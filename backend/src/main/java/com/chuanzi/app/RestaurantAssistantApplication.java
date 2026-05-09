package com.chuanzi.app;

import com.chuanzi.app.config.AppConfig;
import com.chuanzi.app.db.Database;
import com.chuanzi.app.handler.ApiHandler;
import com.chuanzi.app.handler.RootHandler;
import com.chuanzi.app.handler.StaticFileHandler;
import com.chuanzi.app.repository.DishRepository;
import com.chuanzi.app.repository.OrderRepository;
import com.chuanzi.app.repository.SessionRepository;
import com.chuanzi.app.repository.UserRepository;
import com.chuanzi.app.service.AccountService;
import com.chuanzi.app.service.AuthService;
import com.chuanzi.app.service.DishService;
import com.chuanzi.app.service.OrderService;
import com.sun.net.httpserver.HttpServer;

import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.util.concurrent.Executors;

public class RestaurantAssistantApplication {
    public static void main(String[] args) throws Exception {
        AppConfig config = AppConfig.fromEnv();
        Database database = new Database(config);

        UserRepository userRepository = new UserRepository(database);
        SessionRepository sessionRepository = new SessionRepository(database);
        DishRepository dishRepository = new DishRepository(database);
        OrderRepository orderRepository = new OrderRepository(database);

        AuthService authService = new AuthService(userRepository, sessionRepository, config);
        AccountService accountService = new AccountService(userRepository, config);
        DishService dishService = new DishService(dishRepository);
        OrderService orderService = new OrderService(dishRepository, orderRepository);

        ApiHandler apiHandler = new ApiHandler(authService, accountService, dishService, orderService, config);
        StaticFileHandler staticFileHandler = new StaticFileHandler(Path.of(config.webRoot()));

        HttpServer server = HttpServer.create(new InetSocketAddress(config.appPort()), 0);
        server.createContext("/", new RootHandler(apiHandler, staticFileHandler));
        server.setExecutor(Executors.newFixedThreadPool(20));
        server.start();

        System.out.println("[Chuanzi] Server started at http://127.0.0.1:" + config.appPort());
        System.out.println("[Chuanzi] Static web root: " + Path.of(config.webRoot()).toAbsolutePath());
    }
}
