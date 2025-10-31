import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpContext;

import java.io.IOException;
import java.io.OutputStream;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.io.ByteArrayOutputStream;
import java.sql.*;
import java.util.*;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

public class Server {

    public static void main(String[] args) {
        try {
            System.out.println("啟動 SnackForest 伺服器...");
            
            HttpServer server = HttpServer.create(new InetSocketAddress(8000), 0);
            // Run light-weight DB migrations (safe if run multiple times)
            try (Connection conn = DBConnect.getConnection()) {
                ensureCustomerColumns(conn);
            } catch (Exception e) {
                System.err.println("啟動前資料庫欄位檢查/建立失敗（可稍後再試）：" + e.getMessage());
            }

            HttpContext productsCtx = server.createContext("/api/products", new ProductsHandler());
            HttpContext dbDebugCtx = server.createContext("/api/debug/db", new DbDebugHandler());
        HttpContext staticCtx = server.createContext("/frontend", new StaticHandler());
        // serve root as static too so requests like /index.html or /cart.html work
        HttpContext rootCtx = server.createContext("/", new StaticHandler());
            HttpContext imagesCtx = server.createContext("/frontend/images/products/", new ImageFileHandler());
            // New context to serve files saved under data/uploads/images
            HttpContext uploadsCtx = server.createContext("/uploads/images/", new UploadsImageFileHandler());
            HttpContext pingCtx = server.createContext("/ping", exchange -> {
                try {
                    JSONObject resp = new JSONObject();
                    resp.put("status", "ok");
                    resp.put("timestamp", System.currentTimeMillis());
                    sendJsonResponse(exchange, resp.toString(), 200);
                } catch (Exception e) {
                    System.err.println("處理 ping 請求時發生錯誤: " + e.getMessage());
                    e.printStackTrace();
                }
            });
            HttpContext categoryCtx = server.createContext("/api/category", new CategoryHandler());
            HttpContext categoriesCtx = server.createContext("/api/categories", new CategoryHandler());
            HttpContext orderCtx = server.createContext("/api/order", new OrderHandler());
            HttpContext shipCtx = server.createContext("/api/shippingmethod", new ShippingMethodHandler());
            HttpContext payCtx = server.createContext("/api/paymentmethod", new PaymentMethodHandler());
            HttpContext loginCtx = server.createContext("/api/login", new LoginHandler());
            HttpContext uploadCtx = server.createContext("/api/upload/image", new ImageUploadHandler());
            HttpContext deleteCtx = server.createContext("/api/upload/image/delete", new ImageDeleteHandler());
        HttpContext carouselCtx = server.createContext("/api/carousel", new CarouselHandler());
        HttpContext siteConfigCtx = server.createContext("/api/site-config", new SiteConfigHandler());
        HttpContext customerProfileCtx = server.createContext("/api/customer-profile", new CustomerProfileHandler());

    HttpContext[] allContexts = {productsCtx, dbDebugCtx, staticCtx, rootCtx, imagesCtx, uploadsCtx, pingCtx, categoryCtx, categoriesCtx, orderCtx, shipCtx, payCtx, loginCtx, uploadCtx, deleteCtx, carouselCtx, siteConfigCtx, customerProfileCtx};
            for (HttpContext ctx : allContexts) ctx.getFilters().add(new CorsFilter());

            server.start();
            System.out.println("✅ Server started at http://localhost:8000");
            
            // Prevent main thread from exiting so HttpServer keeps running
            while (true) {
                Thread.sleep(30_000);
                System.out.println("伺服器運行中... " + new java.util.Date());
            }
        } catch (Exception e) {
            System.err.println("❌ 伺服器啟動失敗: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    // --- Local minimal HttpUtils replacement ---
    private static void sendJsonResponse(HttpExchange exchange, String body, int status) throws IOException {
        byte[] bytes = body == null ? new byte[0] : body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
    }

    private static void sendNoContent(HttpExchange exchange, int status) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(status, -1);
    }

    private static void sendErrorResponse(HttpExchange exchange, int status, String message, Exception e) throws IOException {
        JSONObject obj = new JSONObject();
        obj.put("error", message == null ? JSONObject.NULL : message);
        if (e != null) obj.put("detail", e.getMessage());
        String body = obj.toString();
        byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        try {
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
        } catch (IOException ioe) {
            System.err.println("Failed to send error response: " + ioe.getMessage());
        }
        if (e != null) e.printStackTrace();
    }

    // --- DB migrations ---
    static void ensureCustomerColumns(Connection conn) throws SQLException {
        String dbName = null;
        try (PreparedStatement ps = conn.prepareStatement("SELECT DATABASE()")) {
            try (ResultSet rs = ps.executeQuery()) { if (rs.next()) dbName = rs.getString(1); }
        }
        if (dbName == null || dbName.isEmpty()) return;

        String[][] columns = new String[][]{
            {"Email", "VARCHAR(255) NULL"},
            {"Address", "TEXT NULL"},
            {"AvatarUrl", "VARCHAR(512) NULL"},
            {"UpdatedAt", "DATETIME NULL"}
        };

        for (String[] col : columns) {
            String name = col[0];
            String ddl = col[1];
            boolean exists = false;
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='customers' AND COLUMN_NAME=?")) {
                ps.setString(1, dbName);
                ps.setString(2, name);
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) exists = rs.getInt(1) > 0; }
            }
            if (!exists) {
                String sql = "ALTER TABLE customers ADD COLUMN " + name + " " + ddl;
                try (PreparedStatement alter = conn.prepareStatement(sql)) { alter.executeUpdate(); }
            }
        }
    }

    // --- Simple CORS filter ---
    static class CorsFilter extends com.sun.net.httpserver.Filter {
        @Override
        public void doFilter(HttpExchange exchange, Chain chain) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
                exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization, Slug, slug");
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            chain.doFilter(exchange);
        }

        @Override
        public String description() { return "Adds CORS headers"; }
    }

    // --- Utility Methods ---
    private static final Path IMAGES_DIR = Paths.get("..", "frontend", "images", "products").toAbsolutePath().normalize();
    // New location for user uploads, outside of frontend so Live Server won't auto-reload
    private static final Path UPLOADS_DIR = Paths.get("..", "data", "uploads", "images").toAbsolutePath().normalize();
    private static final Path DATA_DIR = Paths.get("..", "data").toAbsolutePath().normalize();

    private static List<String> cleanImageUrlList(List<String> raw) {
        List<String> out = new ArrayList<>();
        if (raw == null) return out;
        for (String s : raw) {
            if (s == null) continue;
            String t = s.trim();
            if ((t.startsWith("\"") && t.endsWith("\"")) || (t.startsWith("'") && t.endsWith("'"))) {
                if (t.length() >= 2) t = t.substring(1, t.length() - 1);
            }
            out.add(t);
        }
        return out;
    }

    private static String normalizeImageUrl(String rawUrl) {
        if (rawUrl == null) return null;
        String trimmed = rawUrl.trim().replace('\\', '/');
        if (trimmed.isEmpty()) return null;
        final String productsPrefix = "/frontend/images/products/";
        final String uploadsPrefix = "/uploads/images/";
        // If already absolute path with known prefixes and file exists, return as-is
        if (trimmed.startsWith(productsPrefix)) {
            String filename = trimmed.substring(productsPrefix.length());
            Path candidate = IMAGES_DIR.resolve(filename).normalize();
            if (candidate.startsWith(IMAGES_DIR) && Files.exists(candidate) && Files.isRegularFile(candidate)) return trimmed;
        }
        if (trimmed.startsWith(uploadsPrefix)) {
            String filename = trimmed.substring(uploadsPrefix.length());
            Path candidate = UPLOADS_DIR.resolve(filename).normalize();
            if (candidate.startsWith(UPLOADS_DIR) && Files.exists(candidate) && Files.isRegularFile(candidate)) return trimmed;
        }
        // If it's an absolute path without known prefix, try to map filename to either directory
        if (trimmed.startsWith("/")) {
            String base = trimmed.substring(trimmed.lastIndexOf('/') + 1);
            if (!base.isEmpty()) {
                Path u = UPLOADS_DIR.resolve(base).normalize();
                if (u.startsWith(UPLOADS_DIR) && Files.exists(u) && Files.isRegularFile(u)) return uploadsPrefix + base;
                Path p = IMAGES_DIR.resolve(base).normalize();
                if (p.startsWith(IMAGES_DIR) && Files.exists(p) && Files.isRegularFile(p)) return productsPrefix + base;
            }
        }
        // Fallback: search by base name in uploads first, then products
        String filenameToSearch = trimmed;
        int lastSlash = trimmed.lastIndexOf('/');
        if (lastSlash > -1) filenameToSearch = trimmed.substring(lastSlash + 1);
        final String baseName = filenameToSearch;
        if (baseName.isEmpty()) return null;
        try {
            if (Files.exists(UPLOADS_DIR) && Files.isDirectory(UPLOADS_DIR)) {
                try (java.util.stream.Stream<Path> s = Files.list(UPLOADS_DIR)) {
                    Optional<Path> found = s.filter(p -> p.getFileName().toString().startsWith(baseName)).findFirst();
                    if (found.isPresent()) return uploadsPrefix + found.get().getFileName().toString();
                }
            }
            if (Files.exists(IMAGES_DIR) && Files.isDirectory(IMAGES_DIR)) {
                try (java.util.stream.Stream<Path> s = Files.list(IMAGES_DIR)) {
                    Optional<Path> found = s.filter(p -> p.getFileName().toString().startsWith(baseName)).findFirst();
                    if (found.isPresent()) return productsPrefix + found.get().getFileName().toString();
                }
            }
        } catch (Exception e) {
            System.err.println(java.time.LocalDateTime.now() + " - Error in normalizeImageUrl: " + e.getMessage());
        }
        return null;
    }

    // --- Handlers ---

    static class PaymentMethodHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            JSONArray jsonArray = new JSONArray();
            try (Connection conn = DBConnect.getConnection()) {
                List<model.PaymentMethod> methods = new dao.PaymentMethodDAO(conn).getAll();
                for (model.PaymentMethod method : methods) {
                    JSONObject jsonObject = new JSONObject();
                    jsonObject.put("id", method.getId());
                    jsonObject.put("name", method.getMethodName());
                    jsonArray.put(jsonObject);
                }
                sendJsonResponse(exchange, jsonArray.toString(), 200);
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "Failed to retrieve payment methods", e);
            }
        }
    }

    static class ShippingMethodHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            JSONArray jsonArray = new JSONArray();
            try (Connection conn = DBConnect.getConnection()) {
                List<model.ShippingMethod> methods = new dao.ShippingMethodDAO(conn).getAll();
                for (model.ShippingMethod m : methods) {
                    JSONObject o = new JSONObject();
                    o.put("id", m.getId());
                    o.put("name", m.getMethodName());
                    jsonArray.put(o);
                }
                sendJsonResponse(exchange, jsonArray.toString(), 200);
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "Failed to retrieve shipping methods", e);
            }
        }
    }

    static class OrderHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                if ("GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                    JSONArray ordersArray = new JSONArray();
                    try (Connection conn = DBConnect.getConnection()) {
                        String sql = "SELECT o.idOrders, o.idCustomers, o.OrderDate, o.TotalAmount, c.CustomerName, o.ShippingMethod, o.PaymentMethod, o.RecipientName, o.RecipientAddress, o.RecipientPhone FROM orders o JOIN customers c ON o.idCustomers = c.idCustomers ORDER BY o.OrderDate DESC";
                        String detailSql = "SELECT od.idOrders, od.Quantity, od.PriceAtTimeOfPurchase, p.ProductName FROM order_details od JOIN products p ON od.idProducts = p.idProducts";

                        Map<Integer, JSONObject> ordersMap = new LinkedHashMap<>();

                        try (PreparedStatement stmt = conn.prepareStatement(sql); ResultSet rs = stmt.executeQuery()) {
                            while (rs.next()) {
                                JSONObject order = new JSONObject();
                                order.put("id", rs.getInt("idOrders"));
                                order.put("orderDate", rs.getTimestamp("OrderDate"));
                                order.put("totalAmount", rs.getBigDecimal("TotalAmount"));
                                String customerNameVal = rs.getString("CustomerName");
                                if (customerNameVal == null) customerNameVal = "";
                                order.put("customerName", customerNameVal);
                                try { order.put("customerId", rs.getInt("idCustomers")); } catch (Exception __ignore) {}
                                order.put("status", JSONObject.NULL);
                                String ship = rs.getString("ShippingMethod");
                                order.put("shippingMethod", ship == null ? "" : ship);
                                String pay = rs.getString("PaymentMethod");
                                order.put("paymentMethod", pay == null ? "" : pay);
                                String rName = rs.getString("RecipientName"); if (rName == null) rName = "";
                                String rAddr = rs.getString("RecipientAddress"); if (rAddr == null) rAddr = "";
                                String rPhone = rs.getString("RecipientPhone"); if (rPhone == null) rPhone = "";
                                // If recipient name is empty, fallback to customer name so admin list shows something
                                if (rName.isEmpty()) rName = customerNameVal == null ? "" : customerNameVal;
                                // Debug: log what we read from DB for recipient fields
                                System.err.println("OrderHandler - DB values for orderId=" + rs.getInt("idOrders") + ": RecipientName='" + rName + "', RecipientAddress='" + rAddr + "', RecipientPhone='" + rPhone + "'");
                                order.put("recipientName", rName);
                                order.put("recipientAddress", rAddr);
                                order.put("recipientPhone", rPhone);
                                order.put("details", new JSONArray());
                                ordersMap.put(order.getInt("id"), order);
                            }
                        }

                        try (PreparedStatement detailStmt = conn.prepareStatement(detailSql); ResultSet detailRs = detailStmt.executeQuery()) {
                            while (detailRs.next()) {
                                int orderId = detailRs.getInt("idOrders");
                                if (ordersMap.containsKey(orderId)) {
                                    JSONObject order = ordersMap.get(orderId);
                                    JSONArray detailsArray = order.getJSONArray("details");
                                    JSONObject detail = new JSONObject();
                                    detail.put("productName", detailRs.getString("ProductName"));
                                    detail.put("quantity", detailRs.getInt("Quantity"));
                                    detail.put("priceAtTimeOfPurchase", detailRs.getBigDecimal("PriceAtTimeOfPurchase"));
                                    detailsArray.put(detail);
                                }
                            }
                        }
                        ordersArray = new JSONArray(ordersMap.values());
                        // Some setups may return empty recipient fields in the first query (e.g. permissions,
                        // driver quirks or unexpected NULLs). As a robust fallback, for any order that
                        // has empty recipient info, re-query the orders table for that single order id
                        // and fill the missing values before returning the response.
                        try (PreparedStatement refillStmt = conn.prepareStatement(
                                "SELECT RecipientName, RecipientAddress, RecipientPhone FROM orders WHERE idOrders = ?")) {
                            for (Map.Entry<Integer, JSONObject> e : ordersMap.entrySet()) {
                                JSONObject ord = e.getValue();
                                String rn = ord.optString("recipientName", "");
                                String ra = ord.optString("recipientAddress", "");
                                String rp = ord.optString("recipientPhone", "");
                                if ((rn == null || rn.isEmpty()) || (ra == null || ra.isEmpty()) || (rp == null || rp.isEmpty())) {
                                    try {
                                        refillStmt.setInt(1, e.getKey());
                                        try (ResultSet rrs = refillStmt.executeQuery()) {
                                            if (rrs.next()) {
                                                String rName2 = rrs.getString("RecipientName"); if (rName2 == null) rName2 = "";
                                                String rAddr2 = rrs.getString("RecipientAddress"); if (rAddr2 == null) rAddr2 = "";
                                                String rPhone2 = rrs.getString("RecipientPhone"); if (rPhone2 == null) rPhone2 = "";
                                                // only overwrite when the existing value is empty to avoid clobbering valid data
                                                if (rn == null || rn.isEmpty()) ord.put("recipientName", rName2);
                                                if (ra == null || ra.isEmpty()) ord.put("recipientAddress", rAddr2);
                                                if (rp == null || rp.isEmpty()) ord.put("recipientPhone", rPhone2);
                                                System.err.println("OrderHandler - refill DB values for orderId=" + e.getKey() + ": RecipientName='" + rName2 + "', RecipientAddress='" + rAddr2 + "', RecipientPhone='" + rPhone2 + "'");
                                            }
                                        }
                                    } catch (SQLException ex) {
                                        System.err.println("OrderHandler - failed to refill recipient fields for orderId=" + e.getKey() + ": " + ex.getMessage());
                                    }
                                }
                            }
                        } catch (SQLException e) {
                            // non-fatal: we'll still return whatever we have
                            System.err.println("OrderHandler - refill loop failed: " + e.getMessage());
                        }

                        ordersArray = new JSONArray(ordersMap.values());
                        sendJsonResponse(exchange, ordersArray.toString(), 200);
                    } catch (SQLException e) {
                        sendErrorResponse(exchange, 500, "Failed to retrieve orders", e);
                    }
                } else if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                    InputStream is = exchange.getRequestBody();
                    String body;
                    try (java.util.Scanner s = new java.util.Scanner(is, "UTF-8").useDelimiter("\\A")){
                        body = s.hasNext() ? s.next() : "";
                    }
                    JSONObject req = new JSONObject(body);
                    try (Connection conn = DBConnect.getConnection()) {
                        dao.OrderDAO orderDAO = new dao.OrderDAO(conn);
                        Map<model.Product, Integer> cart = new LinkedHashMap<>();
                        JSONArray items = req.optJSONArray("items");
                        if (items == null) {
                            sendErrorResponse(exchange, 400, "Missing items in order request", null);
                            return;
                        }
                        java.math.BigDecimal computedTotal = java.math.BigDecimal.ZERO;
                        for (int i = 0; i < items.length(); i++) {
                            JSONObject it = items.getJSONObject(i);
                            int productId = it.has("id") ? it.getInt("id") : it.optInt("productId", 0);
                            if (productId == 0) {
                                sendErrorResponse(exchange, 400, "Each item must include 'id' or 'productId'", null);
                                return;
                            }
                            int qty = it.has("quantity") ? it.getInt("quantity") : it.optInt("qty", 1);
                            int price = it.has("price") ? it.getInt("price") : it.optInt("unitPrice", 0);
                            if (price == 0) {
                                model.Product dbp = new dao.ProductDAO(conn).findById(productId);
                                if (dbp == null) {
                                    sendErrorResponse(exchange, 400, "Product not found: " + productId, null);
                                    return;
                                }
                                price = dbp.getPrice();
                            }
                            model.Product p = new model.Product(productId, 0, it.optString("name", ""), price);
                            cart.put(p, qty);
                            computedTotal = computedTotal.add(java.math.BigDecimal.valueOf((long)price * qty));
                        }

                        int customerId = 1;
                        if (req.has("customerId")) {
                            customerId = req.getInt("customerId");
                        }

                        java.math.BigDecimal total = req.has("total") ? java.math.BigDecimal.valueOf(req.getDouble("total")) : computedTotal;

                        String shippingMethod = req.optString("shippingMethod", req.optString("shippingMethodName", ""));
                        String paymentMethod = req.optString("paymentMethod", req.optString("paymentMethodName", ""));
                        String recipientName = req.optString("recipientName", req.optString("recipient", ""));
                        String recipientAddress = req.optString("recipientAddress", req.optString("address", ""));
                        String recipientPhone = req.optString("recipientPhone", req.optString("phone", ""));

                        model.Order order = new model.Order(customerId, total,
                            shippingMethod,
                            paymentMethod,
                            recipientName,
                            recipientAddress,
                            recipientPhone);

                        int orderId = orderDAO.save(order, cart);
                        JSONObject resp = new JSONObject();
                        if (orderId > 0) {
                            resp.put("orderId", orderId);
                            sendJsonResponse(exchange, resp.toString(), 201);
                        } else {
                            sendErrorResponse(exchange, 500, "Failed to create order", null);
                        }
                    }
                }
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "An unexpected error occurred in order handling", e);
            }
        }
    }

    static class DbDebugHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                return;
            }
            JSONObject resp = new JSONObject();
            try (Connection conn = DBConnect.getConnection()) {
                String sql = "SELECT COUNT(*) AS cnt FROM products";
                try (PreparedStatement stmt = conn.prepareStatement(sql); ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) resp.put("productsCount", rs.getInt("cnt"));
                }
                try (PreparedStatement colStmt = conn.prepareStatement("SHOW COLUMNS FROM products"); ResultSet cols = colStmt.executeQuery()) {
                    JSONArray colsArray = new JSONArray();
                    while (cols.next()) colsArray.put(cols.getString("Field"));
                    resp.put("productsColumns", colsArray);
                }
                resp.put("db", "ok");
                sendJsonResponse(exchange, resp.toString(), 200);
            } catch (Exception e) {
                resp.put("db", "error");
                resp.put("message", e.getMessage());
                e.printStackTrace();
                sendJsonResponse(exchange, resp.toString(), 500);
            }
        }
    }

    static class ProductsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            try (Connection conn = DBConnect.getConnection()) {
                dao.ProductDAO productDAO = new dao.ProductDAO(conn);

                if ("GET".equalsIgnoreCase(method)) {
                    String path = exchange.getRequestURI().getPath();
                    String[] parts = path.split("/");
                    // If no specific ID provided, return list of all products
                    if (parts.length <= 3) {
                        try {
                            List<model.Product> products = productDAO.findAll();
                            JSONArray out = new JSONArray();
                            for (model.Product p : products) {
                                JSONObject obj = new JSONObject();
                                obj.put("id", p.getIdProducts());
                                obj.put("name", p.getProductName());
                                obj.put("price", p.getPrice());
                                obj.put("categoryId", p.getCategoriesID());
                                obj.put("categoryName", p.getCategoryName());
                                obj.put("introduction", p.getIntroduction() == null ? JSONObject.NULL : p.getIntroduction());
                                obj.put("origin", p.getOrigin() == null ? JSONObject.NULL : p.getOrigin());
                                obj.put("productionDate", p.getProductionDate() == null ? JSONObject.NULL : p.getProductionDate());
                                obj.put("expiryDate", p.getExpiryDate() == null ? JSONObject.NULL : p.getExpiryDate());
                                List<String> cleaned = cleanImageUrlList(p.getImageUrlList());
                                JSONArray imgsOut = new JSONArray();
                                for (String u : cleaned) {
                                    String nu = normalizeImageUrl(u);
                                    if (nu != null) imgsOut.put(nu);
                                }
                                obj.put("imageUrls", imgsOut);
                                out.put(obj);
                            }
                            sendJsonResponse(exchange, out.toString(), 200);
                            return;
                        } catch (Exception e) {
                            sendErrorResponse(exchange, 500, "Failed to list products", e);
                            return;
                        }
                    }
                    if (parts.length > 3) {
                        try {
                            int id = Integer.parseInt(parts[3]);
                            model.Product product = productDAO.findById(id);
                                if (product != null) {
                                JSONObject jsonObject = new JSONObject();
                                jsonObject.put("id", product.getIdProducts());
                                jsonObject.put("name", product.getProductName());
                                jsonObject.put("price", product.getPrice());
                                jsonObject.put("categoryId", product.getCategoriesID());
                                jsonObject.put("categoryName", product.getCategoryName());
                                    jsonObject.put("introduction", product.getIntroduction() == null ? JSONObject.NULL : product.getIntroduction());
                                    jsonObject.put("origin", product.getOrigin() == null ? JSONObject.NULL : product.getOrigin());
                                    jsonObject.put("productionDate", product.getProductionDate() == null ? JSONObject.NULL : product.getProductionDate());
                                    jsonObject.put("expiryDate", product.getExpiryDate() == null ? JSONObject.NULL : product.getExpiryDate());
                                List<String> cleaned = cleanImageUrlList(product.getImageUrlList());
                                JSONArray imgsOut = new JSONArray();
                                for (String u : cleaned) imgsOut.put(normalizeImageUrl(u));
                                jsonObject.put("imageUrls", imgsOut);
                                sendJsonResponse(exchange, jsonObject.toString(), 200);
                            }
                        } catch (NumberFormatException e) {
                            sendErrorResponse(exchange, 400, "Invalid product ID format", e);
                        }
                    }
                } else if ("POST".equalsIgnoreCase(method)) {
                    String body;
                    try (java.util.Scanner s = new java.util.Scanner(exchange.getRequestBody(), "UTF-8").useDelimiter("\\A")){
                        body = s.hasNext() ? s.next() : "";
                    }
                    JSONObject req = new JSONObject(body);
                    int nextId = productDAO.getNextProductId();
                    JSONArray imgsArr = req.optJSONArray("imageUrls");
                    List<String> imageList = new ArrayList<>();
                    if (imgsArr != null) {
                        for (int i = 0; i < imgsArr.length(); i++) {
                            String val = imgsArr.optString(i, null);
                            if (val != null) imageList.add(val);
                        }
                    }
                    String intro = req.optString("introduction", null);
                    String origin = req.optString("origin", null);
                    String productionDate = req.optString("productionDate", null);
                    String expiryDate = req.optString("expiryDate", null);
                    model.Product p = new model.Product(nextId, req.getInt("categoryId"), req.getString("name"), req.getInt("price"), null, null, intro, origin, productionDate, expiryDate);
                    boolean ok = productDAO.save(p, req.getInt("categoryId"), imageList);
                    if (ok) sendJsonResponse(exchange, new JSONObject().put("id", nextId).toString(), 201);
                    else sendErrorResponse(exchange, 500, "Failed to create product", null);
                } else if ("PUT".equalsIgnoreCase(method)) {
                    String path = exchange.getRequestURI().getPath();
                    int id = Integer.parseInt(path.substring(path.lastIndexOf('/') + 1));
                    String body;
                    try (java.util.Scanner s = new java.util.Scanner(exchange.getRequestBody(), "UTF-8").useDelimiter("\\A")){
                        body = s.hasNext() ? s.next() : "";
                    }
                    JSONObject req = new JSONObject(body);
                    JSONArray imgsArr2 = req.optJSONArray("imageUrls");
                    List<String> imageList2 = new ArrayList<>();
                    if (imgsArr2 != null) {
                        for (int i = 0; i < imgsArr2.length(); i++) {
                            String vv = imgsArr2.optString(i, null);
                            if (vv != null) imageList2.add(vv);
                        }
                    }
                    String intro2 = req.optString("introduction", null);
                    String origin2 = req.optString("origin", null);
                    String productionDate2 = req.optString("productionDate", null);
                    String expiryDate2 = req.optString("expiryDate", null);
                    boolean ok = productDAO.update(id, req.optString("name", ""), req.optInt("price", 0), req.optInt("categoryId", 0), imageList2, intro2, origin2, productionDate2, expiryDate2);
                    if (ok) sendNoContent(exchange, 200);
                } else if ("DELETE".equalsIgnoreCase(method)) {
                    String path = exchange.getRequestURI().getPath();
                    int id = Integer.parseInt(path.substring(path.lastIndexOf('/') + 1));
                    if (productDAO.delete(id)) sendNoContent(exchange, 200);
                } else {
                    sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                }
            } catch (Exception e) {
                if (e instanceof SQLException) {
                    SQLException se = (SQLException) e;
                    System.err.println("SQL Exception in ProductsHandler: SQLState=" + se.getSQLState() + ", ErrorCode=" + se.getErrorCode() + ", Message=" + se.getMessage());
                    se.printStackTrace();
                }
                sendErrorResponse(exchange, 500, "Failed to retrieve products from database", e);
            }
        }
    }

    static class CategoryHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            try (Connection conn = DBConnect.getConnection()) {
                dao.CategoryDAO categoryDAO = new dao.CategoryDAO(conn);
                if ("GET".equalsIgnoreCase(method)) {
                    List<model.Category> categories = categoryDAO.findAll();
                    JSONArray jsonArray = new JSONArray();
                    for (model.Category c : categories) {
                        JSONObject jsonObject = new JSONObject();
                        jsonObject.put("id", c.getId());
                        jsonObject.put("name", c.getName());
                        jsonArray.put(jsonObject);
                    }
                    sendJsonResponse(exchange, jsonArray.toString(), 200);
                } else if ("POST".equalsIgnoreCase(method)) {
                    String body;
                    try (java.util.Scanner s = new java.util.Scanner(exchange.getRequestBody(), "UTF-8").useDelimiter("\\A")){
                        body = s.hasNext() ? s.next() : "";
                    }
                    JSONObject req = new JSONObject(body);
                    String name = req.optString("name", "").trim();
                    if (name.isEmpty()) {
                        sendErrorResponse(exchange, 400, "Missing 'name' for category", null);
                        return;
                    }
                    model.Category newCategory = new model.Category(0, name); // ID will be generated by DB
                    int newId = categoryDAO.save(newCategory);
                    if (newId != -1) {
                        sendJsonResponse(exchange, new JSONObject().put("id", newId).toString(), 201);
                    } else {
                        sendErrorResponse(exchange, 500, "Failed to create category", null);
                    }
                } else if ("DELETE".equalsIgnoreCase(method)) {
                    String path = exchange.getRequestURI().getPath();
                    int id = Integer.parseInt(path.substring(path.lastIndexOf('/') + 1));
                    if (categoryDAO.delete(id)) {
                        sendNoContent(exchange, 200);
                    } else {
                        sendErrorResponse(exchange, 404, "Category not found for deletion", null);
                    }
                } else if ("PUT".equalsIgnoreCase(method)) {
                    String path = exchange.getRequestURI().getPath();
                    int id = 0;
                    try {
                        id = Integer.parseInt(path.substring(path.lastIndexOf('/') + 1));
                    } catch (Exception ignore) {
                        // fallback to body field below
                    }
                    String body;
                    try (java.util.Scanner s = new java.util.Scanner(exchange.getRequestBody(), "UTF-8").useDelimiter("\\A")){
                        body = s.hasNext() ? s.next() : "";
                    }
                    JSONObject req = new JSONObject(body);
                    if (id==0) id = req.optInt("id", 0);
                    String name = req.optString("name", "").trim();
                    if (id <= 0) { sendErrorResponse(exchange, 400, "Missing category id", null); return; }
                    if (name.isEmpty()) { sendErrorResponse(exchange, 400, "Missing 'name' for category", null); return; }
                    model.Category updatedCategory = new model.Category(id, name);
                    if (categoryDAO.update(updatedCategory)) {
                        sendNoContent(exchange, 200);
                    } else {
                        sendErrorResponse(exchange, 404, "Category not found for update", null);
                    }
                }
            } catch(Exception e){ sendErrorResponse(exchange, 500, "An unexpected error occurred in category handling", e); }
        }
    }

    static class LoginHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                return;
            }
            try {
                String body;
                try (java.util.Scanner s = new java.util.Scanner(exchange.getRequestBody(), "UTF-8").useDelimiter("\\A")){
                    body = s.hasNext() ? s.next() : "";
                }
                JSONObject req = new JSONObject(body);
                String username = req.optString("username");
                String password = req.optString("password");
                JSONObject resp = new JSONObject();
                boolean loggedIn = false;
                if ("admin".equals(username) && "000000".equals(password)) {
                    resp.put("success", true);
                    resp.put("role", "admin");
                    loggedIn = true;
                } else {
                    try (Connection conn = DBConnect.getConnection()) {
                        dao.CustomerDAO customerDAO = new dao.CustomerDAO(conn);
                        model.Customer customer = customerDAO.findByAccountAndPassword(username, password);
                        if (customer != null) {
                            resp.put("success", true);
                            resp.put("role", "customer");
                            resp.put("customerId", customer.getId());
                            resp.put("customerName", customer.getName());
                            loggedIn = true;
                        }
                    } catch (SQLException | java.security.NoSuchAlgorithmException e) {
                        e.printStackTrace();
                        sendErrorResponse(exchange, 500, "Login error", e);
                        return;
                    }
                }
                if (loggedIn) sendJsonResponse(exchange, resp.toString(), 200); 
                else sendErrorResponse(exchange, 401, "帳號或密碼錯誤", null);
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "An unexpected error occurred during login", e);
            }
        }
    }

    static class ImageUploadHandler implements HttpHandler {
        // store uploads under data/uploads/images so Live Server won't reload
        private static final Path UPLOAD_DIR_PATH = Paths.get("..", "data", "uploads", "images").toAbsolutePath().normalize();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                return;
            }
            try {
                String fileName = exchange.getRequestHeaders().getFirst("Slug");
                if (fileName == null || fileName.trim().isEmpty()) {
                    fileName = exchange.getRequestHeaders().getFirst("slug");
                }
                if (fileName == null || fileName.trim().isEmpty()) {
                    sendErrorResponse(exchange, 400, "Bad Request: Missing Slug header with filename", null);
                    return;
                }

                // Sanitize filename to prevent directory traversal
                fileName = fileName.replaceAll("[^a-zA-Z0-9._-]", "_");

                InputStream is = exchange.getRequestBody();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = is.read(buffer)) != -1) {
                    baos.write(buffer, 0, bytesRead);
                }
                byte[] fileContent = baos.toByteArray();

                String fileExtension = "";
                int dotIndex = fileName.lastIndexOf('.');
                if (dotIndex > 0) {
                    fileExtension = fileName.substring(dotIndex);
                }
                if (fileExtension.isEmpty()) {
                    String ct = exchange.getRequestHeaders().getFirst("Content-Type");
                    if (ct != null) {
                        String l = ct.toLowerCase(java.util.Locale.ROOT);
                        if (l.contains("png")) fileExtension = ".png";
                        else if (l.contains("jpeg") || l.contains("jpg")) fileExtension = ".jpg";
                        else if (l.contains("gif")) fileExtension = ".gif";
                    }
                    if (fileExtension.isEmpty()) fileExtension = ".png";
                }

                String uniqueFilename = UUID.randomUUID().toString() + fileExtension;
                Files.createDirectories(UPLOAD_DIR_PATH);
                Path filePath = UPLOAD_DIR_PATH.resolve(uniqueFilename);
                Files.write(filePath, fileContent);

                JSONObject responseJson = new JSONObject();
                String imageUrl = "/uploads/images/" + uniqueFilename;
                responseJson.put("imageUrl", imageUrl);
                System.err.println(java.time.LocalDateTime.now() + " - ImageUploadHandler: saved " + filePath.toString() + " -> returning " + imageUrl);
                sendJsonResponse(exchange, responseJson.toString(), 200);

            } catch (Exception e) {
                e.printStackTrace();
                sendErrorResponse(exchange, 500, "Internal Server Error during image upload", e);
            }
        }
    }

    static class ImageDeleteHandler implements HttpHandler {
        private static final Path LEGACY_DIR = Paths.get("..", "frontend", "images", "products").toAbsolutePath().normalize();
        private static final Path UPLOAD_DIR = Paths.get("..", "data", "uploads", "images").toAbsolutePath().normalize();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                return;
            }
            String body;
            try (java.util.Scanner s = new java.util.Scanner(exchange.getRequestBody(), "UTF-8").useDelimiter("\\A")){
                body = s.hasNext() ? s.next() : "";
            }
            try {
                JSONObject req = new JSONObject(body);
                String imageUrl = req.optString("imageUrl", null);
                String filename = req.optString("filename", null);
                if (imageUrl == null && filename == null) {
                    sendErrorResponse(exchange, 400, "Missing imageUrl or filename", null);
                    return;
                }
                if (imageUrl != null) {
                    // extract filename from url
                    int idx = imageUrl.lastIndexOf('/');
                    if (idx >= 0) filename = imageUrl.substring(idx + 1);
                    else filename = imageUrl;
                }
                // sanitize
                filename = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
                // try uploads first
                Path target = UPLOAD_DIR.resolve(filename).normalize();
                boolean deleted = false;
                if (target.startsWith(UPLOAD_DIR) && Files.exists(target)) {
                    Files.delete(target);
                    deleted = true;
                } else {
                    Path legacy = LEGACY_DIR.resolve(filename).normalize();
                    if (legacy.startsWith(LEGACY_DIR) && Files.exists(legacy)) {
                        Files.delete(legacy);
                        deleted = true;
                    }
                }
                if (!deleted) {
                    sendErrorResponse(exchange, 404, "File not found: " + filename, null);
                    return;
                }
                JSONObject resp = new JSONObject();
                resp.put("deleted", filename);
                sendJsonResponse(exchange, resp.toString(), 200);
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "Failed to delete image", e);
            }
        }
    }

    static class ImageFileHandler implements HttpHandler {
        private static final Path IMAGES_DIR = Paths.get("..", "frontend", "images", "products").toAbsolutePath().normalize();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                String uriPath = exchange.getRequestURI().getPath();
                String fileName = uriPath.substring(uriPath.lastIndexOf('/') + 1);
                Path imagePath = IMAGES_DIR.resolve(fileName).normalize();
                System.err.println(java.time.LocalDateTime.now() + " - ImageFileHandler: Attempting to serve image at path: " + imagePath.toString());
                System.err.println(java.time.LocalDateTime.now() + " - ImageFileHandler: Files.exists(imagePath): " + Files.exists(imagePath));
                System.err.println(java.time.LocalDateTime.now() + " - ImageFileHandler: Files.isReadable(imagePath): " + Files.isReadable(imagePath));

                if (!imagePath.startsWith(IMAGES_DIR) || !Files.exists(imagePath) || !Files.isReadable(imagePath)) {
                    sendErrorResponse(exchange, 404, "Image not found: " + fileName, null);
                    return;
                }

                String contentType = Files.probeContentType(imagePath);
                if (contentType == null) contentType = "application/octet-stream";

                exchange.getResponseHeaders().set("Content-Type", contentType);
                exchange.sendResponseHeaders(200, Files.size(imagePath));
                try (OutputStream os = exchange.getResponseBody()) {
                    Files.copy(imagePath, os);
                }
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "Error serving image", e);
            }
        }
    }

    // Serve files from the new uploads directory under data/uploads/images
    static class UploadsImageFileHandler implements HttpHandler {
        private static final Path BASE_DIR = Paths.get("..", "data", "uploads", "images").toAbsolutePath().normalize();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                String uriPath = exchange.getRequestURI().getPath();
                String fileName = uriPath.substring(uriPath.lastIndexOf('/') + 1);
                Path imagePath = BASE_DIR.resolve(fileName).normalize();
                if (!imagePath.startsWith(BASE_DIR) || !Files.exists(imagePath) || !Files.isReadable(imagePath)) {
                    sendErrorResponse(exchange, 404, "Image not found: " + fileName, null);
                    return;
                }
                String contentType = Files.probeContentType(imagePath);
                if (contentType == null) contentType = "application/octet-stream";
                exchange.getResponseHeaders().set("Content-Type", contentType);
                exchange.sendResponseHeaders(200, Files.size(imagePath));
                try (OutputStream os = exchange.getResponseBody()) { Files.copy(imagePath, os); }
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "Error serving upload image", e);
            }
        }
    }

    static class StaticHandler implements HttpHandler {
        private final Path baseDir;

        public StaticHandler() {
            Path candidate1 = Paths.get("frontend").toAbsolutePath().normalize();
            Path candidate2 = Paths.get("..", "frontend").toAbsolutePath().normalize();
            if (Files.exists(candidate1) && Files.isDirectory(candidate1)) baseDir = candidate1;
            else if (Files.exists(candidate2) && Files.isDirectory(candidate2)) baseDir = candidate2;
            else baseDir = candidate1;
            System.err.println(java.time.LocalDateTime.now() + " - StaticHandler baseDir = " + baseDir.toString());
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String uriPath = exchange.getRequestURI().getPath();
            // normalize common root requests
            if (uriPath.equals("/") || uriPath.equals("/frontend") || uriPath.equals("/frontend/")) {
                uriPath = "/frontend/client/index.html";
            }

            // If request starts with /frontend, resolve normally under baseDir
            Path resolved = null;
            if (uriPath.startsWith("/frontend")) {
                String rel = uriPath.substring("/frontend".length());
                resolved = baseDir.resolve(rel.substring(1)).normalize();
            } else {
                // Try resolving directly under baseDir first (e.g., /frontend/client/cart.html -> handled above),
                // but for root-level requests like /cart.html, try mapping to frontend/client/<name>
                String candidatePath = uriPath.startsWith("/") ? uriPath.substring(1) : uriPath;
                Path direct = baseDir.resolve(candidatePath).normalize();
                if (Files.exists(direct) && direct.startsWith(baseDir) && Files.isReadable(direct)) {
                    resolved = direct;
                } else {
                    // fallback: try frontend/client/<candidatePath>
                    Path clientCandidate = baseDir.resolve("client").resolve(candidatePath).normalize();
                    if (Files.exists(clientCandidate) && clientCandidate.startsWith(baseDir) && Files.isReadable(clientCandidate)) {
                        resolved = clientCandidate;
                    }
                }
            }

            if (resolved == null || !resolved.startsWith(baseDir) || !Files.exists(resolved) || !Files.isReadable(resolved)) {
                sendErrorResponse(exchange, 404, "Static file not found", null);
                return;
            }

            if (Files.isDirectory(resolved)) resolved = resolved.resolve("index.html");
            if (!Files.exists(resolved)) { sendErrorResponse(exchange, 404, "Static file not found", null); return; }

            String contentType = Files.probeContentType(resolved);
            if (contentType == null) contentType = "application/octet-stream";
            exchange.getResponseHeaders().set("Content-Type", contentType + "; charset=UTF-8");
            exchange.sendResponseHeaders(200, Files.size(resolved));
            try (OutputStream os = exchange.getResponseBody()) { Files.copy(resolved, os); }
        }
    }

    // Carousel slides persistence (shared across site)
    static class CarouselHandler implements HttpHandler {
        private static final Path CAROUSEL_FILE = DATA_DIR.resolve("carousel.json");

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            try {
                if ("GET".equalsIgnoreCase(method)) {
                    String defaultJson = "[]";
                    String json;
                    if (Files.exists(CAROUSEL_FILE)) {
                        json = Files.readString(CAROUSEL_FILE, java.nio.charset.StandardCharsets.UTF_8);
                    } else {
                        json = defaultJson;
                    }
                    sendJsonResponse(exchange, json, 200);
                } else if ("PUT".equalsIgnoreCase(method) || "POST".equalsIgnoreCase(method)) {
                    String body;
                    try (java.util.Scanner s = new java.util.Scanner(exchange.getRequestBody(), "UTF-8").useDelimiter("\\A")) {
                        body = s.hasNext() ? s.next() : "[]";
                    }
                    // Validate it's an array
                    try { new org.json.JSONArray(body); } catch (Exception e) {
                        sendErrorResponse(exchange, 400, "Invalid JSON array for carousel", e);
                        return;
                    }
                    Files.createDirectories(CAROUSEL_FILE.getParent());
                    Files.writeString(CAROUSEL_FILE, body, java.nio.charset.StandardCharsets.UTF_8,
                            java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);
                    sendNoContent(exchange, 200);
                } else {
                    sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                }
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "Carousel handler error", e);
            }
        }
    }

    // Site config (hero/benefits/branding/footer)
    static class SiteConfigHandler implements HttpHandler {
        private static final Path CONFIG_FILE = DATA_DIR.resolve("site-config.json");

        private static String readFileOrDefault(Path path, String defaultJson) throws IOException {
            if (!Files.exists(path)) return defaultJson;
            return Files.readString(path, java.nio.charset.StandardCharsets.UTF_8);
        }

        private static void writeJsonToFile(Path path, String json) throws IOException {
            Files.createDirectories(path.getParent());
            Files.writeString(path, json, java.nio.charset.StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);
        }

        private static final String DEFAULT_CONFIG = new JSONObject()
                .put("hero", new JSONObject()
                        .put("title", "探索世界零食的靈感地圖")
                        .put("subtitle", "精挑細選、快速到貨、安心付款。從人氣熱銷到限時新品，一鍵帶你吃遍全球風味。")
                        .put("imageUrl", "/frontend/images/products/no-image.svg")
                        .put("primaryText", "開始購物")
                        .put("primaryLink", "product.html")
                        .put("secondaryText", "逛逛全部")
                        .put("secondaryLink", "product.html?category=all"))
                .put("benefits", new JSONArray()
                        .put(new JSONObject().put("icon", "truck-fast").put("title", "快速到貨").put("desc", "下單 24 小時內出貨"))
                        .put(new JSONObject().put("icon", "shield-halved").put("title", "安全付款").put("desc", "多元支付、SSL 安全"))
                        .put(new JSONObject().put("icon", "arrows-rotate").put("title", "七日鑑賞").put("desc", "不滿意可退換"))
                        .put(new JSONObject().put("icon", "gift").put("title", "會員回饋").put("desc", "點數折抵更划算")))
                .put("featuredProductIds", new JSONArray())
                .put("branding", new JSONObject()
                        .put("logoUrl", "")
                        .put("brandName", "SnackForest")
                        .put("tagline", "探索零食世界"))
                .put("footer", new JSONObject().put("text", "© 2025 SnackForest. 保留所有權利。"))
                .toString();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            try {
                if ("GET".equalsIgnoreCase(method)) {
                    String json = readFileOrDefault(CONFIG_FILE, DEFAULT_CONFIG);
                    sendJsonResponse(exchange, json, 200);
                } else if ("PUT".equalsIgnoreCase(method) || "POST".equalsIgnoreCase(method)) {
                    String body;
                    try (java.util.Scanner s = new java.util.Scanner(exchange.getRequestBody(), "UTF-8").useDelimiter("\\A")) {
                        body = s.hasNext() ? s.next() : DEFAULT_CONFIG;
                    }
                    // validate JSON object
                    try { new JSONObject(body); } catch (Exception e) {
                        sendErrorResponse(exchange, 400, "Invalid JSON object for site-config", e);
                        return;
                    }
                    writeJsonToFile(CONFIG_FILE, body);
                    sendNoContent(exchange, 200);
                } else {
                    sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                }
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "Site config handler error", e);
            }
        }
    }

    // Customer profile: GET /api/customer-profile/{id}, PUT /api/customer-profile/{id}
    static class CustomerProfileHandler implements HttpHandler {
        private static final Path PROFILES_FILE = DATA_DIR.resolve("customer-profiles.json");

        private static JSONObject readProfiles() {
            try {
                if (!Files.exists(PROFILES_FILE)) return new JSONObject();
                String json = Files.readString(PROFILES_FILE, java.nio.charset.StandardCharsets.UTF_8);
                return new JSONObject(json);
            } catch (Exception e) {
                System.err.println("readProfiles error: " + e.getMessage());
                return new JSONObject();
            }
        }

        private static void writeProfiles(JSONObject obj) throws IOException {
            Files.createDirectories(PROFILES_FILE.getParent());
            Files.writeString(PROFILES_FILE, obj.toString(), java.nio.charset.StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);
        }

        private static String getCustomerNameById(int id) {
            try (Connection conn = DBConnect.getConnection()) {
                try (PreparedStatement ps = conn.prepareStatement("SELECT CustomerName FROM customers WHERE idCustomers = ?")) {
                    ps.setInt(1, id);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            String name = rs.getString(1);
                            return name == null ? "" : name;
                        }
                    }
                }
            } catch (Exception e) {
                System.err.println("getCustomerNameById error: " + e.getMessage());
            }
            return "";
        }

        private static String inferExtension(String fileName, String contentType) {
            String ext = "";
            if (fileName != null) {
                int dot = fileName.lastIndexOf('.');
                if (dot > -1) ext = fileName.substring(dot).toLowerCase(Locale.ROOT);
            }
            if (ext.isEmpty() && contentType != null) {
                String ct = contentType.toLowerCase(Locale.ROOT);
                if (ct.contains("png")) ext = ".png";
                else if (ct.contains("jpeg")) ext = ".jpg";
                else if (ct.contains("jpg")) ext = ".jpg";
                else if (ct.contains("gif")) ext = ".gif";
                else if (ct.contains("webp")) ext = ".webp";
            }
            if (ext.isEmpty()) ext = ".png";
            return ext;
        }

        // use outer Server.ensureCustomerColumns for migrations

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();
            // Expect /api/customer-profile/{id}
            String[] parts = path.split("/");
            if (parts.length < 4) {
                sendErrorResponse(exchange, 400, "Missing customer id", null);
                return;
            }
            int id;
            try { id = Integer.parseInt(parts[3]); } catch (Exception e) {
                sendErrorResponse(exchange, 400, "Invalid customer id", e);
                return;
            }

            if ("GET".equalsIgnoreCase(method)) {
                JSONObject store = readProfiles();
                JSONObject profile = store.optJSONObject(String.valueOf(id));
                if (profile == null) profile = new JSONObject();
                profile.put("customerId", String.valueOf(id));

                // Merge with DB values (DB takes precedence when present)
                try (Connection conn = DBConnect.getConnection()) {
                    Server.ensureCustomerColumns(conn);
                    try (PreparedStatement ps = conn.prepareStatement(
                            "SELECT CustomerName, Email, Phone, Address, AvatarUrl, UpdatedAt FROM customers WHERE idCustomers=?")) {
                        ps.setInt(1, id);
                        try (ResultSet rs = ps.executeQuery()) {
                            if (rs.next()) {
                                String name = rs.getString("CustomerName");
                                String email = rs.getString("Email");
                                String phone = rs.getString("Phone");
                                String address = rs.getString("Address");
                                String avatar = rs.getString("AvatarUrl");
                                java.sql.Timestamp updated = rs.getTimestamp("UpdatedAt");
                                if (name != null && !name.isEmpty()) profile.put("displayName", name);
                                if (email != null) profile.put("email", email); else if (!profile.has("email")) profile.put("email", JSONObject.NULL);
                                if (phone != null) profile.put("phone", phone); else if (!profile.has("phone")) profile.put("phone", JSONObject.NULL);
                                if (address != null) profile.put("address", address); else if (!profile.has("address")) profile.put("address", JSONObject.NULL);
                                if (avatar != null) profile.put("avatarUrl", avatar); else if (!profile.has("avatarUrl")) profile.put("avatarUrl", JSONObject.NULL);
                                if (updated != null) profile.put("updatedAt", updated.toInstant().toString());
                            } else {
                                // fallback if no row: seed with name if available
                                String name = getCustomerNameById(id);
                                if (name != null && !name.isEmpty()) profile.put("displayName", name);
                                if (!profile.has("email")) profile.put("email", JSONObject.NULL);
                                if (!profile.has("phone")) profile.put("phone", JSONObject.NULL);
                                if (!profile.has("address")) profile.put("address", JSONObject.NULL);
                                if (!profile.has("avatarUrl")) profile.put("avatarUrl", JSONObject.NULL);
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("GET customer-profile merge DB failed: " + e.getMessage());
                    if (!profile.has("email")) profile.put("email", JSONObject.NULL);
                    if (!profile.has("phone")) profile.put("phone", JSONObject.NULL);
                    if (!profile.has("address")) profile.put("address", JSONObject.NULL);
                    if (!profile.has("avatarUrl")) profile.put("avatarUrl", JSONObject.NULL);
                }

                sendJsonResponse(exchange, profile.toString(), 200);
                return;
            }

            if ("PUT".equalsIgnoreCase(method)) {
                String body;
                try (java.util.Scanner s = new java.util.Scanner(exchange.getRequestBody(), "UTF-8").useDelimiter("\\A")) {
                    body = s.hasNext() ? s.next() : "{}";
                }
                JSONObject req;
                try { req = new JSONObject(body); } catch (Exception e) {
                    sendErrorResponse(exchange, 400, "Invalid JSON", e);
                    return;
                }

                JSONObject store = readProfiles();
                JSONObject existing = store.optJSONObject(String.valueOf(id));
                if (existing == null) existing = new JSONObject();

                // Merge updatable fields
                String displayName = req.optString("displayName", null);
                String email = req.optString("email", null);
                String phone = req.optString("phone", null);
                String address = req.optString("address", null);

                if (displayName != null && !displayName.isEmpty()) existing.put("displayName", displayName);
                if (email != null) existing.put("email", email.isEmpty() ? JSONObject.NULL : email);
                if (phone != null) existing.put("phone", phone.isEmpty() ? JSONObject.NULL : phone);
                if (address != null) existing.put("address", address.isEmpty() ? JSONObject.NULL : address);

                // Handle avatar upload if present
                String avatarData = req.optString("avatarData", null);
                String avatarFileName = req.optString("avatarFileName", null);
                String avatarContentType = req.optString("avatarContentType", null);
                String finalAvatarUrl = null;
                if (avatarData != null && !avatarData.isEmpty()) {
                    try {
                        byte[] bytes = java.util.Base64.getDecoder().decode(avatarData);
                        Files.createDirectories(UPLOADS_DIR);
                        String ext = inferExtension(avatarFileName, avatarContentType);
                        String unique = "customer-" + id + "-" + System.currentTimeMillis() + ext;
                        Path target = UPLOADS_DIR.resolve(unique).normalize();
                        if (!target.startsWith(UPLOADS_DIR)) throw new IOException("Invalid upload path");
                        Files.write(target, bytes);
                        String avatarUrl = "/uploads/images/" + unique;
                        existing.put("avatarUrl", avatarUrl);
                        finalAvatarUrl = avatarUrl;
                    } catch (Exception e) {
                        System.err.println("Failed to save avatar: " + e.getMessage());
                        // Keep previous avatar on failure
                    }
                }

                existing.put("customerId", String.valueOf(id));
                existing.put("updatedAt", java.time.Instant.now().toString());
                store.put(String.valueOf(id), existing);
                writeProfiles(store);

                // Persist into customers table
                try (Connection conn = DBConnect.getConnection()) {
                    Server.ensureCustomerColumns(conn);
                    String sql = "UPDATE customers SET CustomerName = COALESCE(?, CustomerName), " +
                            "Email = ?, Phone = ?, Address = ?, AvatarUrl = ?, UpdatedAt = NOW() WHERE idCustomers = ?";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        ps.setString(1, displayName);
                        ps.setString(2, email);
                        ps.setString(3, phone);
                        ps.setString(4, address);
                        String avatarForDb = finalAvatarUrl != null ? finalAvatarUrl : existing.optString("avatarUrl", null);
                        if (avatarForDb != null && avatarForDb.isEmpty()) avatarForDb = null;
                        ps.setString(5, avatarForDb);
                        ps.setInt(6, id);
                        ps.executeUpdate();
                    }
                } catch (Exception e) {
                    System.err.println("Persisting customer profile to DB failed: " + e.getMessage());
                }
                sendJsonResponse(exchange, existing.toString(), 200);
                return;
            }

            sendErrorResponse(exchange, 405, "Method Not Allowed", null);
        }
    }
}
