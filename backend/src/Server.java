import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpContext;

import java.io.IOException;
import java.io.OutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URL;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.io.ByteArrayOutputStream;
import java.sql.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * SnackForest 後端 HTTP 伺服器入口點，負責啟動嵌入式 HttpServer、註冊 API 與靜態資源處理器，
 * 並在啟動前執行輕量資料庫遷移以確保必備欄位存在。
 */
public class Server {

    /**
     * 應用程式進入點：建立 HttpServer、註冊所有 API 上下文並啟動常駐迴圈。
     * @param args CLI 參數，目前未使用。
     */
    public static void main(String[] args) {
        try {
            System.out.println("啟動 SnackForest 伺服器...");

            int port = resolvePort();
            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
            // 啟動前執行資料庫欄位檢查：確保管理端客製功能需要的欄位都存在。
            try (Connection conn = DBConnect.getConnection()) {
                ensureCustomerColumns(conn);
            } catch (Exception e) {
                System.err.println("啟動前資料庫欄位檢查/建立失敗（可稍後再試）：" + e.getMessage());
            }

            // API: 商品列表，供前台 client/js/product-list.js 與 admin/js/products.js 讀取。
            HttpContext productsCtx = server.createContext("/api/products", new ProductsHandler());
            // API: 資料庫除錯介面，僅管理端工具使用。
            HttpContext dbDebugCtx = server.createContext("/api/debug/db", new DbDebugHandler());
            // 靜態資源：對應 /frontend 目錄，給管理端/前台 HTML、JS、CSS 使用。
            HttpContext staticCtx = server.createContext("/frontend", new StaticHandler());
            // 靜態資源：根路徑導到前端頁面（例如 /index.html、/cart.html）。
            HttpContext rootCtx = server.createContext("/", new StaticHandler());
            // 統一處理靜態圖片資源
            HttpContext imagesCtx = server.createContext("/frontend/images/products/", new GenericFileHandler(IMAGES_DIR, null, "Image not found"));
            HttpContext uploadsCtx = server.createContext("/uploads/Carousel/", new GenericFileHandler(UPLOADS_DIR, "/uploads/Carousel/", "Image not found"));
            HttpContext avatarUploadsCtx = server.createContext("/uploads/avatar/", new GenericFileHandler(AVATAR_UPLOADS_DIR, "/uploads/avatar/", "Avatar not found"));
            HttpContext heroUploadsCtx = server.createContext("/uploads/hero/", new GenericFileHandler(HERO_UPLOADS_DIR, "/uploads/hero/", "Hero image not found"));
            // 健康檢查：前端 env.js 或監控工具可呼叫 /ping 檢查伺服器是否存活。
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
            // API: 單一分類 CRUD，供 admin/js/categories.js 操作表單使用。
            HttpContext categoryCtx = server.createContext("/api/category", new CategoryHandler());
            // API: 分類清單列表，供前台與管理端載入下拉與側邊導航。
            HttpContext categoriesCtx = server.createContext("/api/categories", new CategoryHandler());
            // API: 訂單管理，對應 admin/js/orders.js 與 client/js/cart.js 結帳流程。
            HttpContext orderCtx = server.createContext("/api/order", new OrderHandler());
            // API: 配送方式清單，供 admin/js/orders.js 與 client/js/cart-page.js 使用。
            HttpContext shipCtx = server.createContext("/api/shippingmethod", new ShippingMethodHandler());
            // API: 付款方式清單，供 admin/js/orders.js 與 client/js/cart-page.js 使用。
            HttpContext payCtx = server.createContext("/api/paymentmethod", new PaymentMethodHandler());
            // API: 登入驗證，對應 client/js/auth-guard.js 與 admin/js/auth 模組。
            HttpContext loginCtx = server.createContext("/api/login", new LoginHandler());
            // API: 顧客註冊（前端 register.html 會 POST /api/customers）
            HttpContext customersCtx = server.createContext("/api/customers", new CustomersHandler());
            // API: 圖片上傳，同步管理端商品與輪播管理上傳需求。
            HttpContext uploadCtx = server.createContext("/api/upload/image", new ImageUploadHandler());
            // API: 圖片刪除，與 admin/js/images.js 清理功能對應。
            HttpContext deleteCtx = server.createContext("/api/upload/image/delete", new ImageDeleteHandler());
            // API: 英雄圖庫列舉（支援列出 R2 或本機 hero 上傳目錄）
            HttpContext heroGalleryCtx = server.createContext("/api/gallery/hero", new HeroGalleryApiHandler());
            // API: 首頁輪播設定，供 admin/js/carousel.js 管理輪播資料。
            HttpContext carouselCtx = server.createContext("/api/carousel", new CarouselHandler());
            // API: 網站設定，對應 admin/js/site-config.js 控制基本資訊。
            HttpContext siteConfigCtx = server.createContext("/api/site-config", new SiteConfigHandler());
            // API: 客戶輪廓資料，提供 admin/js/customer-profiles.js 與前台會員頁面。
            HttpContext customerProfileCtx = server.createContext("/api/customer-profile", new CustomerProfileHandler());

            // 彙總所有 Context，統一加入 CORS Filter 以支援跨來源的前端 fetch。
            HttpContext[] allContexts = {productsCtx, dbDebugCtx, staticCtx, rootCtx, imagesCtx, uploadsCtx, avatarUploadsCtx, heroUploadsCtx, pingCtx, categoryCtx, categoriesCtx, orderCtx, shipCtx, payCtx, loginCtx, customersCtx, uploadCtx, deleteCtx, carouselCtx, siteConfigCtx, heroGalleryCtx, customerProfileCtx};
            for (HttpContext ctx : allContexts) ctx.getFilters().add(new CorsFilter());

            server.start();
            System.out.println("✅ Server started at http://localhost:" + port);
            
            // 保持主執行緒存活，避免 HttpServer 因 main 結束而停止服務。
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

    private static int resolvePort() {
        String envPort = System.getenv("PORT");
        if (envPort != null) {
            try {
                int parsed = Integer.parseInt(envPort.trim());
                if (parsed > 0 && parsed <= 65535) return parsed;
            } catch (NumberFormatException ignored) {
                System.err.println("無法解析 PORT 環境變數，改用預設 8000：" + envPort);
            }
        }
        return 8000;
    }

    // --- 內建 Http 工具函式（取代額外依賴） ---
    /**
     * 送出 JSON 回應，統一設定 Content-Type 與 UTF-8 編碼。
     * @param exchange 當前請求的交換物件。
     * @param body 要回傳的 JSON 字串內容，允許為 null。
     * @param status HTTP 狀態碼。
     * @throws IOException 回應寫入失敗時拋出。
     */
    private static void sendJsonResponse(HttpExchange exchange, String body, int status) throws IOException {
        byte[] bytes = body == null ? new byte[0] : body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
    }

    /**
     * 傳送無內容回應（例如 OPTIONS 預檢），維持 JSON Content-Type 與 -1 內容長度。
     * @param exchange 當前請求。
     * @param status HTTP 狀態碼。
     * @throws IOException 回應寫入失敗時拋出。
     */
    private static void sendNoContent(HttpExchange exchange, int status) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(status, -1);
    }

    /**
     * 以統一格式回傳錯誤 JSON，並視需要附上 detail 訊息與堆疊輸出。
     * @param exchange 當前請求。
     * @param status HTTP 狀態碼。
     * @param message 對客戶端顯示的錯誤訊息，可為 null。
     * @param e 例外物件，若提供則會在 detail 中附上 message。
     * @throws IOException 回應寫入失敗時拋出。
     */
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

    private static String readRequestBody(HttpExchange exchange, String defaultValue) throws IOException {
        if (exchange == null) return defaultValue;
        try (InputStream is = exchange.getRequestBody();
             java.util.Scanner scanner = new java.util.Scanner(is, StandardCharsets.UTF_8.name())) {
            scanner.useDelimiter("\\A");
            return scanner.hasNext() ? scanner.next() : defaultValue;
        }
    }

    private static List<String> toStringList(JSONArray array) {
        List<String> out = new ArrayList<>();
        if (array == null) {
            return out;
        }
        for (int i = 0; i < array.length(); i++) {
            String value = array.optString(i, null);
            if (value != null) {
                out.add(value);
            }
        }
        return out;
    }

    // --- 啟動時的資料庫欄位補強 ---
    /**
     * 檢查 customers 資料表是否具備新欄位，缺少時動態補上，允許在啟動時重複執行。
     * @param conn SQL 連線。
     * @throws SQLException 取得資料庫資訊或 ALTER TABLE 失敗時拋出。
     */
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
                // 管理端客戶資料維護需要這些欄位，缺少就即時補上避免前端欄位錯誤。
                String sql = "ALTER TABLE customers ADD COLUMN " + name + " " + ddl;
                try (PreparedStatement alter = conn.prepareStatement(sql)) { alter.executeUpdate(); }
            }
        }
    }

    // --- 簡易 CORS 過濾器 ---
    /**
     * 最小化的 CORS Filter，允許所有來源並處理預檢請求。
     */
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

    // --- 共用工具函式與路徑常數 ---
    // 前端根目錄支援在本機（專案根目錄）與容器內（/app/frontend）執行。
    private static final Path FRONTEND_DIR = resolveExistingDirectory(
            Paths.get("frontend"),
            Paths.get("..", "frontend")
    );
    // 前端預設產品圖目錄，供 normalizeImageUrl 對應 /frontend/images/products/ 靜態資源。
    private static final Path IMAGES_DIR = resolveExistingDirectory(
            FRONTEND_DIR.resolve("images").resolve("products"),
            Paths.get("frontend", "images", "products"),
            Paths.get("..", "frontend", "images", "products")
    );
    // 使用者上傳檔案儲存位置，管理端商品/輪播上傳皆寫入此處。
    /**
     * 支援透過環境變數指定資料根目錄（方便在主機上掛載持久化路徑）：
     * - DATA_ROOT: 根 data 目錄（預設 ./data）
     * - UPLOADS_ROOT: 完整上傳圖片目錄（若指定，將直接使用該路徑，例如 /var/snackforest/data/uploads/images）
     * - AVATAR_UPLOADS_ROOT: 完整頭像上傳目錄
     */
    private static Path envPathOrDefault(String envVar, Path defaultPath) {
        String v = System.getenv(envVar);
        if (v != null) v = v.trim();
        if (v != null && !v.isEmpty()) return Paths.get(v);
        return defaultPath;
    }

    private static final Path UPLOADS_DIR = resolveExistingDirectory(
        envPathOrDefault("UPLOADS_ROOT", Paths.get("data", "uploads", "Carousel")),
        Paths.get("data", "uploads", "Carousel"),
        Paths.get("..", "data", "uploads", "Carousel")
    );

    private static final Path AVATAR_UPLOADS_DIR = resolveExistingDirectory(
        envPathOrDefault("AVATAR_UPLOADS_ROOT", Paths.get("data", "uploads", "avatar")),
        Paths.get("data", "uploads", "avatar"),
        Paths.get("..", "data", "uploads", "avatar")
    );

    private static final Path HERO_UPLOADS_DIR = resolveExistingDirectory(
        envPathOrDefault("HERO_UPLOADS_ROOT", Paths.get("data", "uploads", "hero")),
        Paths.get("data", "uploads", "hero"),
        Paths.get("..", "data", "uploads", "hero")
    );

    // data 目錄根路徑，供其他 handler 讀寫 JSON seed 資料。
    private static final Path DATA_DIR = resolveExistingDirectory(
        envPathOrDefault("DATA_ROOT", Paths.get("data")),
        Paths.get("..", "data")
    );
    private static final CloudflareR2Client R2_CLIENT = CloudflareR2Client.fromEnvironment();

    private static Path resolveExistingDirectory(Path... candidates) {
        IOException lastIOException = null;
        for (Path candidate : candidates) {
            if (candidate == null) continue;
            Path normalized = candidate.toAbsolutePath().normalize();
            try {
                if (!Files.exists(normalized)) {
                    Files.createDirectories(normalized);
                }
                if (Files.isDirectory(normalized) && Files.isWritable(normalized)) {
                    return normalized;
                }
            } catch (IOException ioe) {
                lastIOException = ioe;
            }
        }
        Path fallback = candidates.length > 0 ? candidates[0] : Paths.get(".");
        Path normalizedFallback = fallback.toAbsolutePath().normalize();
        if (lastIOException != null) {
            System.err.println(java.time.LocalDateTime.now() + " - Failed to resolve writable directory: " + lastIOException.getMessage());
        }
        return normalizedFallback;
    }

    /**
     * 與 Cloudflare R2 整合的最小客製簽名客戶端，使用 SigV4 直接對 R2 API 上傳/刪除物件。
     */
    static class CloudflareR2Client {
        private static final DateTimeFormatter AMZ_DATE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
        private static final String REGION = "auto";
        private static final String SERVICE = "s3";

        private final String accountId;
        private final String accessKeyId;
        private final String secretAccessKey;
        private final String bucket;
        private final String publicBaseUrl;
        private final String pathPrefix;
        private final String host;

        private CloudflareR2Client(String accountId, String accessKeyId, String secretAccessKey, String bucket, String publicBaseUrl, String pathPrefix) {
            this.accountId = accountId;
            this.accessKeyId = accessKeyId;
            this.secretAccessKey = secretAccessKey;
            this.bucket = bucket;
            this.publicBaseUrl = normalizeBaseUrl(publicBaseUrl);
            this.pathPrefix = normalizePathPrefix(pathPrefix);
            this.host = accountId + ".r2.cloudflarestorage.com";
        }

        static CloudflareR2Client fromEnvironment() {
            String accountId = trimToNull(System.getenv("R2_ACCOUNT_ID"));
            String accessKeyId = trimToNull(System.getenv("R2_ACCESS_KEY_ID"));
            String secretAccessKey = trimToNull(System.getenv("R2_SECRET_ACCESS_KEY"));
            String bucket = trimToNull(System.getenv("R2_BUCKET_NAME"));
            if (accountId == null || accessKeyId == null || secretAccessKey == null || bucket == null) {
                return null;
            }
            String publicBaseUrl = trimToNull(System.getenv("R2_PUBLIC_BASE_URL"));
            String pathPrefix = trimToNull(System.getenv("R2_PATH_PREFIX"));
            if (pathPrefix == null || pathPrefix.isEmpty()) {
                pathPrefix = "uploads/Carousel";
            }
            CloudflareR2Client client = new CloudflareR2Client(accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl, pathPrefix);
            System.err.println(java.time.LocalDateTime.now() + " - Cloudflare R2 configured with bucket=" + bucket + " prefix=" + client.pathPrefix + " publicBase=" + client.publicBaseUrl);
            return client;
        }

        boolean isConfigured() {
            return accountId != null && accessKeyId != null && secretAccessKey != null && bucket != null;
        }

        String buildObjectKey(String filename) {
            return buildObjectKey(filename, null);
        }

        String buildObjectKey(String filename, String overridePrefix) {
            String safeName = sanitizeFilename(filename);
            String prefix = overridePrefix != null ? normalizePathPrefix(overridePrefix) : pathPrefix;
            if (prefix == null || prefix.isEmpty()) return safeName;
            return prefix + "/" + safeName;
        }

        UploadResult uploadObject(String objectKey, byte[] data, String contentType) throws Exception {
            if (!isConfigured()) throw new IllegalStateException("Cloudflare R2 client is not configured");
            if (objectKey == null || objectKey.isEmpty()) {
                objectKey = buildObjectKey(UUID.randomUUID().toString());
            }
            String normalizedKey = objectKey.replace('\\', '/');
            String finalContentType = (contentType == null || contentType.isEmpty()) ? "application/octet-stream" : contentType;
            String payloadHash = sha256Hex(data);
            ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
            String amzDate = AMZ_DATE_TIME.format(now);
            String dateStamp = amzDate.substring(0, 8);

            String canonicalUri = "/" + bucket + "/" + normalizedKey;
            String canonicalHeaders =
                    "content-type:" + finalContentType + "\n" +
                    "host:" + host + "\n" +
                    "x-amz-content-sha256:" + payloadHash + "\n" +
                    "x-amz-date:" + amzDate + "\n";
            String signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
            String canonicalRequest = "PUT\n" + canonicalUri + "\n\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;

            String credentialScope = dateStamp + "/" + REGION + "/" + SERVICE + "/aws4_request";
            String stringToSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + credentialScope + "\n" + sha256Hex(canonicalRequest.getBytes(StandardCharsets.UTF_8));
            byte[] signingKey = signingKey(secretAccessKey, dateStamp, REGION, SERVICE);
            String signature = bytesToHex(hmacSha256(signingKey, stringToSign));

            String authorization = "AWS4-HMAC-SHA256 Credential=" + accessKeyId + "/" + credentialScope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;

            URL url = java.net.URI.create("https://" + host + canonicalUri).toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("PUT");
            conn.setDoOutput(true);
            conn.setConnectTimeout(15_000);
            conn.setReadTimeout(30_000);
            conn.setFixedLengthStreamingMode(data.length);
            conn.setRequestProperty("Content-Type", finalContentType);
            conn.setRequestProperty("x-amz-date", amzDate);
            conn.setRequestProperty("x-amz-content-sha256", payloadHash);
            conn.setRequestProperty("Authorization", authorization);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(data);
            }

            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) {
                String errorBody = readStream(conn.getErrorStream());
                throw new IOException("R2 upload failed with status " + status + ": " + errorBody);
            }

            String publicUrl = toPublicUrl(normalizedKey);
            if (publicUrl == null) {
                publicUrl = "https://" + host + canonicalUri;
            }
            // Retry a few times to reduce eventual-consistency visibility issues
            try {
                int attempts = 0;
                // small sleep between attempts; if headExists becomes true we proceed
                while (attempts < 3 && !headExists(publicUrl)) {
                    attempts++;
                    try { Thread.sleep(300); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                }
            } catch (Exception e) {
                System.err.println(java.time.LocalDateTime.now() + " - R2 head check retry failed: " + e.getMessage());
            }
            return new UploadResult(normalizedKey, publicUrl);
        }

        boolean deleteByReference(String reference) throws Exception {
            if (reference == null || reference.isEmpty()) return false;
            String key = extractObjectKey(reference);
            if (key == null || key.isEmpty()) return false;
            return deleteObject(key);
        }

        /**
         * 列舉指定前綴下的物件清單（使用 S3 ListObjectsV2），回傳 object keys。
         */
        List<String> listObjects(String prefix) throws Exception {
            if (!isConfigured()) throw new IllegalStateException("Cloudflare R2 client is not configured");
            String normalizedPrefix = normalizePathPrefix(prefix == null ? "" : prefix);
            ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
            String amzDate = AMZ_DATE_TIME.format(now);
            String dateStamp = amzDate.substring(0, 8);

            String canonicalUri = "/" + bucket + "/";
            String query = "list-type=2";
            if (normalizedPrefix != null && !normalizedPrefix.isEmpty()) {
                query += "&prefix=" + URLEncoder.encode(normalizedPrefix, "UTF-8");
            }

            String payloadHash = sha256Hex(new byte[0]);
            String canonicalHeaders =
                    "host:" + host + "\n" +
                    "x-amz-content-sha256:" + payloadHash + "\n" +
                    "x-amz-date:" + amzDate + "\n";
            String signedHeaders = "host;x-amz-content-sha256;x-amz-date";
            String canonicalRequest = "GET\n" + canonicalUri + "\n" + query + "\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;

            String credentialScope = dateStamp + "/" + REGION + "/" + SERVICE + "/aws4_request";
            String stringToSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + credentialScope + "\n" + sha256Hex(canonicalRequest.getBytes(StandardCharsets.UTF_8));
            byte[] signingKey = signingKey(secretAccessKey, dateStamp, REGION, SERVICE);
            String signature = bytesToHex(hmacSha256(signingKey, stringToSign));

            String authorization = "AWS4-HMAC-SHA256 Credential=" + accessKeyId + "/" + credentialScope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;

            URL url = java.net.URI.create("https://" + host + canonicalUri + "?" + query).toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(15_000);
            conn.setReadTimeout(30_000);
            conn.setRequestProperty("x-amz-date", amzDate);
            conn.setRequestProperty("x-amz-content-sha256", payloadHash);
            conn.setRequestProperty("Authorization", authorization);

            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) {
                String errorBody = readStream(conn.getErrorStream());
                throw new IOException("R2 listObjects failed with status " + status + ": " + errorBody);
            }

            String xml = readStream(conn.getInputStream());
            List<String> keys = new ArrayList<>();
            if (xml != null && !xml.isEmpty()) {
                try {
                    javax.xml.parsers.DocumentBuilderFactory dbf = javax.xml.parsers.DocumentBuilderFactory.newInstance();
                    javax.xml.parsers.DocumentBuilder db = dbf.newDocumentBuilder();
                    org.w3c.dom.Document doc = db.parse(new java.io.ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
                    org.w3c.dom.NodeList nl = doc.getElementsByTagName("Key");
                    for (int i = 0; i < nl.getLength(); i++) {
                        String k = nl.item(i).getTextContent();
                        if (k != null && !k.trim().isEmpty()) keys.add(k.trim());
                    }
                } catch (Exception e) {
                    throw new IOException("Failed to parse R2 listObjects response: " + e.getMessage(), e);
                }
            }
            return keys;
        }

        String toPublicUrl(String pathOrUrl) {
            if (pathOrUrl == null || pathOrUrl.trim().isEmpty()) return null;
            String trimmed = pathOrUrl.trim();
            if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                return trimmed;
            }
            String key = extractObjectKey(trimmed);
            if (key == null) return null;
            return buildPublicBaseUrl() + "/" + key;
        }

        String toRelativePath(String pathOrUrl) {
            if (pathOrUrl == null || pathOrUrl.trim().isEmpty()) return null;
            String key = extractObjectKey(pathOrUrl);
            if (key == null || key.isEmpty()) return null;
            String normalized = key.replace('\\', '/');
            if (normalized.startsWith("/")) normalized = normalized.substring(1);
            if (normalized.isEmpty()) return null;
            return "/" + normalized;
        }

        private boolean deleteObject(String objectKey) throws Exception {
            String normalizedKey = objectKey.replace('\\', '/');
            ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
            String amzDate = AMZ_DATE_TIME.format(now);
            String dateStamp = amzDate.substring(0, 8);

            String canonicalUri = "/" + bucket + "/" + normalizedKey;
            String payloadHash = sha256Hex(new byte[0]);
            String canonicalHeaders =
                    "host:" + host + "\n" +
                    "x-amz-content-sha256:" + payloadHash + "\n" +
                    "x-amz-date:" + amzDate + "\n";
            String signedHeaders = "host;x-amz-content-sha256;x-amz-date";
            String canonicalRequest = "DELETE\n" + canonicalUri + "\n\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;

            String credentialScope = dateStamp + "/" + REGION + "/" + SERVICE + "/aws4_request";
            String stringToSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + credentialScope + "\n" + sha256Hex(canonicalRequest.getBytes(StandardCharsets.UTF_8));
            byte[] signingKey = signingKey(secretAccessKey, dateStamp, REGION, SERVICE);
            String signature = bytesToHex(hmacSha256(signingKey, stringToSign));

            String authorization = "AWS4-HMAC-SHA256 Credential=" + accessKeyId + "/" + credentialScope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;

            URL url = java.net.URI.create("https://" + host + canonicalUri).toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("DELETE");
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(20_000);
            conn.setRequestProperty("x-amz-date", amzDate);
            conn.setRequestProperty("x-amz-content-sha256", payloadHash);
            conn.setRequestProperty("Authorization", authorization);

            int status = conn.getResponseCode();
            if (status == 404) return false;
            if (status < 200 || status >= 300) {
                String errorBody = readStream(conn.getErrorStream());
                throw new IOException("R2 delete failed with status " + status + ": " + errorBody);
            }
            return true;
        }

        private String extractObjectKey(String reference) {
            if (reference == null || reference.trim().isEmpty()) return null;
            String trimmed = reference.trim();
            if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                if (publicBaseUrl != null && trimmed.startsWith(publicBaseUrl)) {
                    return trimmed.substring(publicBaseUrl.length()).replaceFirst("^/+", "");
                }
                String apiBase = "https://" + host + "/" + bucket + "/";
                if (trimmed.startsWith(apiBase)) {
                    return trimmed.substring(apiBase.length());
                }
                int idx = trimmed.indexOf("/" + bucket + "/");
                if (idx >= 0) {
                    return trimmed.substring(idx + bucket.length() + 2);
                }
                return null;
            }
            String normalized = trimmed.replace('\\', '/');
            if (normalized.startsWith("/")) normalized = normalized.substring(1);
            if (normalized.isEmpty()) return null;
            if (normalized.startsWith(pathPrefix)) return normalized;
            if (normalized.contains("/")) return normalized;
            if (pathPrefix.isEmpty()) return normalized;
            return pathPrefix + "/" + normalized;
        }

        private String buildPublicBaseUrl() {
            if (publicBaseUrl != null && !publicBaseUrl.isEmpty()) {
                String base = publicBaseUrl;
                if (base.contains("{bucket}")) {
                    base = base.replace("{bucket}", bucket);
                }
                return base;
            }
            return "https://" + host + "/" + bucket;
        }

        private static String normalizeBaseUrl(String value) {
            if (value == null) return null;
            String trimmed = value.trim();
            if (trimmed.isEmpty()) return null;
            while (trimmed.endsWith("/")) trimmed = trimmed.substring(0, trimmed.length() - 1);
            return trimmed;
        }

        private static String normalizePathPrefix(String prefix) {
            if (prefix == null) return "";
            String normalized = prefix.replace('\\', '/');
            while (normalized.startsWith("/")) normalized = normalized.substring(1);
            while (normalized.endsWith("/")) normalized = normalized.substring(0, normalized.length() - 1);
            return normalized;
        }

        private static String trimToNull(String value) {
            if (value == null) return null;
            String trimmed = value.trim();
            return trimmed.isEmpty() ? null : trimmed;
        }

        private static String sanitizeFilename(String filename) {
            if (filename == null || filename.isEmpty()) {
                return UUID.randomUUID().toString();
            }
            String cleaned = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
            if (cleaned.isEmpty()) cleaned = UUID.randomUUID().toString();
            return cleaned;
        }

        private static String sha256Hex(byte[] data) throws Exception {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            return bytesToHex(digest);
        }

        private static byte[] hmacSha256(byte[] key, String data) throws Exception {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        }

        private static byte[] signingKey(String secretKey, String dateStamp, String regionName, String serviceName) throws Exception {
            byte[] kSecret = ("AWS4" + secretKey).getBytes(StandardCharsets.UTF_8);
            byte[] kDate = hmacSha256(kSecret, dateStamp);
            byte[] kRegion = hmacSha256(kDate, regionName);
            byte[] kService = hmacSha256(kRegion, serviceName);
            return hmacSha256(kService, "aws4_request");
        }

        private static String bytesToHex(byte[] bytes) {
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(String.format(java.util.Locale.ROOT, "%02x", b));
            }
            return sb.toString();
        }

        private static String readStream(InputStream is) {
            if (is == null) return "";
            try (java.util.Scanner s = new java.util.Scanner(is, StandardCharsets.UTF_8).useDelimiter("\\A")) {
                return s.hasNext() ? s.next() : "";
            }
        }

        static boolean headExists(String url) {
            if (url == null || url.trim().isEmpty()) return false;
            try {
                URL target = java.net.URI.create(url).toURL();
                HttpURLConnection conn = (HttpURLConnection) target.openConnection();
                conn.setRequestMethod("HEAD");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                int code = conn.getResponseCode();
                return code >= 200 && code < 300;
            } catch (Exception e) {
                System.err.println(java.time.LocalDateTime.now() + " - CloudflareR2Client.headExists failed: " + e.getMessage());
                return false;
            }
        }

        static final class UploadResult {
            private final String objectKey;
            private final String publicUrl;

            UploadResult(String objectKey, String publicUrl) {
                this.objectKey = objectKey;
                this.publicUrl = publicUrl;
            }

            String objectKey() { return objectKey; }

            String publicUrl() { return publicUrl; }
        }
    }

    /**
     * 清理影像網址清單，移除 null 與多餘的引號，保持路徑格式一致。
     * @param raw 從資料庫或外部輸入取得的原始列表。
     * @return 處理後的新陣列，永不為 null。
     */
    private static List<String> cleanImageUrlList(List<String> raw) {
        List<String> out = new ArrayList<>();
        if (raw == null) return out;
        // 逐一處理 DAO 回傳的路徑字串，去除外圍引號與空白，確保回傳 JSON 整潔。
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

    /**
     * 將傳入的圖片路徑正規化為前端可存取的 URL，優先對應 uploads，再回落至預設產品圖目錄。
     * @param rawUrl 來源字串，可為絕對或相對路徑。
     * @return 正規化後的路徑，若無法對應有效檔案則回傳 null。
     */
    private static String normalizeImageUrl(String rawUrl) {
        if (rawUrl == null) return null;
        String trimmed = rawUrl.trim().replace('\\', '/');
        String lowered = trimmed.toLowerCase(java.util.Locale.ROOT);
        if (!trimmed.startsWith("/") && (lowered.startsWith("uploads/") || lowered.startsWith("frontend/"))) {
            trimmed = "/" + trimmed;
        }
        if (trimmed.isEmpty()) return null;
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
        final String productsPrefix = "/frontend/images/products/";
        final String uploadsPrefix = "/uploads/Carousel/";
        final String heroPrefix = "/uploads/hero/";
        final String avatarPrefix = "/uploads/avatar/";
        // 若已是帶有既有前綴的絕對路徑且檔案存在，直接回傳原始值。
        if (trimmed.startsWith(productsPrefix)) {
            String filename = trimmed.substring(productsPrefix.length());
            Path candidate = IMAGES_DIR.resolve(filename).normalize();
            if (candidate.startsWith(IMAGES_DIR) && Files.exists(candidate) && Files.isRegularFile(candidate)) return trimmed;
        }
        if (trimmed.startsWith(uploadsPrefix)) {
            String filename = trimmed.substring(uploadsPrefix.length());
            Path candidate = UPLOADS_DIR.resolve(filename).normalize();
            if (candidate.startsWith(UPLOADS_DIR) && Files.exists(candidate) && Files.isRegularFile(candidate)) return trimmed;
            Path avatarCandidate = AVATAR_UPLOADS_DIR.resolve(filename).normalize();
            if (avatarCandidate.startsWith(AVATAR_UPLOADS_DIR) && Files.exists(avatarCandidate) && Files.isRegularFile(avatarCandidate)) {
                return avatarPrefix + filename;
            }
            if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                String avatarRemote = R2_CLIENT.toPublicUrl(avatarPrefix + filename);
                if (avatarRemote != null && CloudflareR2Client.headExists(avatarRemote)) return avatarRemote;
                String remote = R2_CLIENT.toPublicUrl(trimmed);
                if (remote != null && CloudflareR2Client.headExists(remote)) return remote;
            }
        }

        // 支援 /uploads/hero/ 前綴（Hero 專用上傳目錄）
        if (trimmed.startsWith(heroPrefix)) {
            String filename = trimmed.substring(heroPrefix.length());
            Path candidate = HERO_UPLOADS_DIR.resolve(filename).normalize();
            if (candidate.startsWith(HERO_UPLOADS_DIR) && Files.exists(candidate) && Files.isRegularFile(candidate)) return trimmed;
            // 若 hero 目錄下找不到，再檢查 common uploads 與 avatar
            Path uploadsCandidate = UPLOADS_DIR.resolve(filename).normalize();
            if (uploadsCandidate.startsWith(UPLOADS_DIR) && Files.exists(uploadsCandidate) && Files.isRegularFile(uploadsCandidate)) return uploadsPrefix + filename;
            Path avatarCandidate = AVATAR_UPLOADS_DIR.resolve(filename).normalize();
            if (avatarCandidate.startsWith(AVATAR_UPLOADS_DIR) && Files.exists(avatarCandidate) && Files.isRegularFile(avatarCandidate)) return avatarPrefix + filename;
            if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                String remoteHero = R2_CLIENT.toPublicUrl(heroPrefix + filename);
                if (remoteHero != null && CloudflareR2Client.headExists(remoteHero)) return remoteHero;
                String remote = R2_CLIENT.toPublicUrl(uploadsPrefix + filename);
                if (remote != null && CloudflareR2Client.headExists(remote)) return remote;
            }
        }
        if (trimmed.startsWith(avatarPrefix)) {
            String filename = trimmed.substring(avatarPrefix.length());
            Path candidate = AVATAR_UPLOADS_DIR.resolve(filename).normalize();
            if (candidate.startsWith(AVATAR_UPLOADS_DIR) && Files.exists(candidate) && Files.isRegularFile(candidate)) return trimmed;
            if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                String remote = R2_CLIENT.toPublicUrl(trimmed);
                if (remote != null) return remote;
            }
        }
        // 若為其他絕對路徑，嘗試將檔名映射到 uploads 或預設產品圖目錄。
        if (trimmed.startsWith("/")) {
            String base = trimmed.substring(trimmed.lastIndexOf('/') + 1);
            if (!base.isEmpty()) {
                Path u = UPLOADS_DIR.resolve(base).normalize();
                if (u.startsWith(UPLOADS_DIR) && Files.exists(u) && Files.isRegularFile(u)) return uploadsPrefix + base;
                Path a = AVATAR_UPLOADS_DIR.resolve(base).normalize();
                if (a.startsWith(AVATAR_UPLOADS_DIR) && Files.exists(a) && Files.isRegularFile(a)) return avatarPrefix + base;
                Path p = IMAGES_DIR.resolve(base).normalize();
                if (p.startsWith(IMAGES_DIR) && Files.exists(p) && Files.isRegularFile(p)) return productsPrefix + base;
                if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                    String avatarRemote = R2_CLIENT.toPublicUrl(avatarPrefix + base);
                    if (avatarRemote != null && CloudflareR2Client.headExists(avatarRemote)) return avatarRemote;
                    String imageRemote = R2_CLIENT.toPublicUrl(uploadsPrefix + base);
                    if (imageRemote != null && CloudflareR2Client.headExists(imageRemote)) return imageRemote;
                }
            }
        }
            // 最後備援：遍歷 uploads 與 products 目錄，以檔名開頭對應第一個找到的檔案。
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
            if (Files.exists(AVATAR_UPLOADS_DIR) && Files.isDirectory(AVATAR_UPLOADS_DIR)) {
                try (java.util.stream.Stream<Path> s = Files.list(AVATAR_UPLOADS_DIR)) {
                    Optional<Path> found = s.filter(p -> p.getFileName().toString().startsWith(baseName)).findFirst();
                    if (found.isPresent()) return avatarPrefix + found.get().getFileName().toString();
                }
            }
            if (Files.exists(IMAGES_DIR) && Files.isDirectory(IMAGES_DIR)) {
                try (java.util.stream.Stream<Path> s = Files.list(IMAGES_DIR)) {
                    Optional<Path> found = s.filter(p -> p.getFileName().toString().startsWith(baseName)).findFirst();
                    if (found.isPresent()) return productsPrefix + found.get().getFileName().toString();
                }
            }
            if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                String avatarRemote = R2_CLIENT.toPublicUrl(avatarPrefix + baseName);
                if (avatarRemote != null && CloudflareR2Client.headExists(avatarRemote)) return avatarRemote;
                String imageRemote = R2_CLIENT.toPublicUrl(uploadsPrefix + baseName);
                if (imageRemote != null && CloudflareR2Client.headExists(imageRemote)) return imageRemote;
            }
        } catch (Exception e) {
            System.err.println(java.time.LocalDateTime.now() + " - Error in normalizeImageUrl: " + e.getMessage());
        }
        return null;
    }

    private static String extractSanitizedFilename(String reference) {
        if (reference == null) return null;
        String normalized = reference.trim().replace('\\', '/');
        if (normalized.isEmpty()) return null;
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            normalized = normalized.substring(0, queryIndex);
        }
        int fragmentIndex = normalized.indexOf('#');
        if (fragmentIndex >= 0) {
            normalized = normalized.substring(0, fragmentIndex);
        }
        if (normalized.isEmpty()) return null;
        int slashIndex = normalized.lastIndexOf('/');
        String filename = (slashIndex >= 0) ? normalized.substring(slashIndex + 1) : normalized;
        filename = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
        return filename.isEmpty() ? null : filename;
    }

    private static boolean deleteFromLocalDirectories(String filename, Path... directories) throws IOException {
        if (filename == null || filename.isEmpty()) return false;
        for (Path baseDir : directories) {
            if (baseDir == null) continue;
            Path target = baseDir.resolve(filename).normalize();
            if (target.startsWith(baseDir) && Files.exists(target)) {
                Files.delete(target);
                return true;
            }
        }
        return false;
    }

    private static boolean tryServeLocalFile(HttpExchange exchange, Path baseDir, String fileName) throws IOException {
        if (fileName == null || fileName.isEmpty()) return false;
        Path target = baseDir.resolve(fileName).normalize();
        if (!target.startsWith(baseDir) || !Files.exists(target) || !Files.isReadable(target)) {
            return false;
        }
        String contentType = Files.probeContentType(target);
        if (contentType == null) contentType = "application/octet-stream";
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(200, Files.size(target));
        try (OutputStream os = exchange.getResponseBody()) {
            Files.copy(target, os);
        }
        return true;
    }

    private static boolean tryRedirectToR2(HttpExchange exchange, String... references) throws IOException {
        if (R2_CLIENT == null || !R2_CLIENT.isConfigured()) return false;
        for (String ref : references) {
            if (ref == null || ref.trim().isEmpty()) continue;
            String remoteUrl = R2_CLIENT.toPublicUrl(ref);
            if (remoteUrl == null) continue;
            if (!CloudflareR2Client.headExists(remoteUrl)) continue;
            exchange.getResponseHeaders().set("Location", remoteUrl);
            exchange.sendResponseHeaders(302, -1);
            return true;
        }
        return false;
    }

    // --- 各 API 與靜態資源處理器 ---

    /**
     * 提供付款方式列表的 API 處理器，對應 /api/paymentmethod。
     */
    static class PaymentMethodHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            JSONArray jsonArray = new JSONArray();
            try (Connection conn = DBConnect.getConnection()) {
                // 從 dao.PaymentMethodDAO 取得資料，供購物車與管理端下拉選單串接。
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

    /**
     * 提供物流/配送方式列表的 API 處理器，對應 /api/shippingmethod。
     */
    static class ShippingMethodHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            JSONArray jsonArray = new JSONArray();
            try (Connection conn = DBConnect.getConnection()) {
                // 透過 dao.ShippingMethodDAO 讀取資料，對應前台結帳與管理端表單。
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

    /**
     * 處理訂單查詢與建立的 API（/api/order），支援 GET 列表與 POST 建立訂單。
     */
    static class OrderHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                String method = exchange.getRequestMethod();
                switch (method.toUpperCase()) {
                    case "GET":
                        handleGet(exchange);
                        break;
                    case "POST":
                        handlePost(exchange);
                        break;
                    default:
                        sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                        break;
                }
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "An unexpected error occurred in order handling", e);
            }
        }

        private void handleGet(HttpExchange exchange) throws IOException, SQLException {
            try (Connection conn = DBConnect.getConnection()) {
                String sql = "SELECT o.idOrders, o.idCustomers, o.OrderDate, o.TotalAmount, c.CustomerName, " +
                             "o.ShippingMethod, o.PaymentMethod, o.RecipientName, o.RecipientAddress, o.RecipientPhone, " +
                             "od.Quantity, od.PriceAtTimeOfPurchase, p.ProductName " +
                             "FROM orders o " +
                             "JOIN customers c ON o.idCustomers = c.idCustomers " +
                             "LEFT JOIN order_details od ON o.idOrders = od.idOrders " +
                             "LEFT JOIN products p ON od.idProducts = p.idProducts " +
                             "ORDER BY o.OrderDate DESC, o.idOrders";

                Map<Integer, JSONObject> ordersMap = new LinkedHashMap<>();

                try (PreparedStatement stmt = conn.prepareStatement(sql); ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        int orderId = rs.getInt("idOrders");
                        JSONObject order = ordersMap.computeIfAbsent(orderId, id -> {
                            JSONObject newOrder = new JSONObject();
                            newOrder.put("id", id);
                            try {
                                newOrder.put("orderDate", rs.getTimestamp("OrderDate"));
                                newOrder.put("totalAmount", rs.getBigDecimal("TotalAmount"));
                                String customerNameVal = rs.getString("CustomerName");
                                if (customerNameVal == null) customerNameVal = "";
                                newOrder.put("customerName", customerNameVal);
                                newOrder.put("customerId", rs.getInt("idCustomers"));
                                newOrder.put("status", JSONObject.NULL);
                                String ship = rs.getString("ShippingMethod");
                                newOrder.put("shippingMethod", ship == null ? "" : ship);
                                String pay = rs.getString("PaymentMethod");
                                newOrder.put("paymentMethod", pay == null ? "" : pay);
                                String rName = rs.getString("RecipientName");
                                String rAddr = rs.getString("RecipientAddress");
                                String rPhone = rs.getString("RecipientPhone");
                                // 若收件人姓名為空，改採用顧客姓名
                                if (rName == null || rName.isEmpty()) rName = customerNameVal;
                                newOrder.put("recipientName", rName == null ? "" : rName);
                                newOrder.put("recipientAddress", rAddr == null ? "" : rAddr);
                                newOrder.put("recipientPhone", rPhone == null ? "" : rPhone);
                                newOrder.put("details", new JSONArray());
                            } catch (SQLException e) {
                                throw new RuntimeException(e);
                            }
                            return newOrder;
                        });

                        // 如果有訂單明細，則加入
                        if (rs.getString("ProductName") != null) {
                            JSONArray detailsArray = order.getJSONArray("details");
                            JSONObject detail = new JSONObject();
                            detail.put("productName", rs.getString("ProductName"));
                            detail.put("quantity", rs.getInt("Quantity"));
                            detail.put("priceAtTimeOfPurchase", rs.getBigDecimal("PriceAtTimeOfPurchase"));
                            detailsArray.put(detail);
                        }
                    }
                } catch (RuntimeException e) {
                    if (e.getCause() instanceof SQLException) throw (SQLException) e.getCause();
                    else throw e;
                }

                JSONArray ordersArray = new JSONArray(ordersMap.values());
                sendJsonResponse(exchange, ordersArray.toString(), 200);
            }
        }

        private void handlePost(HttpExchange exchange) throws IOException, SQLException {
            String body = readRequestBody(exchange, "");
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

                // 解析 customerId：接受數字或字串數字
                int customerId = 1; // Default customer
                if (req.has("customerId")) {
                    try {
                        // 優先以 int 讀取
                        customerId = req.getInt("customerId");
                    } catch (Exception e) {
                        // 若不是數字型態，嘗試以字串解析
                        String cidStr = req.optString("customerId", "");
                        try {
                            if (cidStr != null && !cidStr.isEmpty()) customerId = Integer.parseInt(cidStr);
                        } catch (NumberFormatException nfe) {
                            // keep default customerId if parse failed
                        }
                    }
                }

                java.math.BigDecimal total = req.has("total") ? java.math.BigDecimal.valueOf(req.getDouble("total")) : computedTotal;

                // 接受 id（shippingMethodId/paymentMethodId）或名稱（shippingMethod/paymentMethod）兩種形式。
                int shippingMethodId = req.optInt("shippingMethodId", 0);
                int paymentMethodId = req.optInt("paymentMethodId", 0);
                String shippingMethod = shippingMethodId > 0 ? String.valueOf(shippingMethodId) : req.optString("shippingMethod", req.optString("shippingMethodName", ""));
                String paymentMethod = paymentMethodId > 0 ? String.valueOf(paymentMethodId) : req.optString("paymentMethod", req.optString("paymentMethodName", ""));

                // 若未提供數字 id，嘗試以名稱查出對應的 id，以滿足 FK INT 欄位需求。
                if (shippingMethodId == 0 && shippingMethod != null && !shippingMethod.isEmpty()) {
                    try {
                        model.ShippingMethod sm = new dao.ShippingMethodDAO(conn).findByName(shippingMethod);
                        if (sm != null) {
                            shippingMethod = String.valueOf(sm.getId());
                        }
                    } catch (Exception e) {
                        // 查詢失敗則保留原值，由 OrderDAO 處理（或最後寫為 NULL）
                    }
                }

                if (paymentMethodId == 0 && paymentMethod != null && !paymentMethod.isEmpty()) {
                    try {
                        model.PaymentMethod pm = new dao.PaymentMethodDAO(conn).findByName(paymentMethod);
                        if (pm != null) {
                            paymentMethod = String.valueOf(pm.getId());
                        }
                    } catch (Exception e) {
                        // 查詢失敗則保留原值，由 OrderDAO 處理（或最後寫為 NULL）
                    }
                }
                String recipientName = req.optString("recipientName", req.optString("recipient", "")).trim();
                String recipientAddress = req.optString("recipientAddress", req.optString("address", "")).trim();
                String recipientPhone = req.optString("recipientPhone", req.optString("phone", "")).trim();

                // 基本輸入驗證：必要欄位缺少時回 400，並提供可讀錯誤訊息
                if (items == null || items.length() == 0) {
                    sendErrorResponse(exchange, 400, "Missing items in order request", null);
                    return;
                }
                if (recipientName.isEmpty() || recipientAddress.isEmpty() || recipientPhone.isEmpty()) {
                    sendErrorResponse(exchange, 400, "Recipient name/address/phone are required", null);
                    return;
                }

                // 檢查運送/付款是否至少提供 id 或名稱
                boolean hasShipping = (shippingMethodId > 0) || (shippingMethod != null && !shippingMethod.isEmpty());
                boolean hasPayment = (paymentMethodId > 0) || (paymentMethod != null && !paymentMethod.isEmpty());
                if (!hasShipping || !hasPayment) {
                    sendErrorResponse(exchange, 400, "Shipping method and payment method are required", null);
                    return;
                }

                model.Order order = new model.Order(customerId, total,
                    shippingMethod, paymentMethod, recipientName, recipientAddress, recipientPhone);

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
    }

    /**
     * 提供簡易資料庫健康檢查資訊的端點（/api/debug/db）。
     */
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

    /**
     * 商品 CRUD API 處理器（/api/products），依 HTTP 方法對應查詢、新增、更新與刪除。
     */
    static class ProductsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            try (Connection conn = DBConnect.getConnection()) {
                dao.ProductDAO productDAO = new dao.ProductDAO(conn);
                switch (method.toUpperCase()) {
                    case "GET":
                        handleGet(exchange, productDAO);
                        break;
                    case "POST":
                        handlePost(exchange, productDAO);
                        break;
                    case "PUT":
                        handlePut(exchange, productDAO);
                        break;
                    case "DELETE":
                        handleDelete(exchange, productDAO);
                        break;
                    default:
                        sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                        break;
                }
            } catch (Exception e) {
                if (e instanceof SQLException) {
                    SQLException se = (SQLException) e;
                    System.err.println("SQL Exception in ProductsHandler: SQLState=" + se.getSQLState() + ", ErrorCode=" + se.getErrorCode() + ", Message=" + se.getMessage());
                    se.printStackTrace();
                }
                sendErrorResponse(exchange, 500, "Failed to process product request", e);
            }
        }

        private void handleGet(HttpExchange exchange, dao.ProductDAO productDAO) throws IOException, SQLException {
            String path = exchange.getRequestURI().getPath();
            String[] parts = path.split("/");
            // 處理 /api/products，回傳所有商品
            if (parts.length <= 3) {
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
            }
            // 處理 /api/products/{id}，回傳單一商品
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
                    } else {
                        sendErrorResponse(exchange, 404, "Product not found", null);
                    }
                } catch (NumberFormatException e) {
                    sendErrorResponse(exchange, 400, "Invalid product ID format", e);
                }
            }
        }

        private void handlePost(HttpExchange exchange, dao.ProductDAO productDAO) throws IOException, SQLException {
            String body = readRequestBody(exchange, "");
            JSONObject req = new JSONObject(body);
            int nextId = productDAO.getNextProductId();
            List<String> imageList = toStringList(req.optJSONArray("imageUrls"));
            String intro = req.optString("introduction", null);
            String origin = req.optString("origin", null);
            String productionDate = req.optString("productionDate", null);
            String expiryDate = req.optString("expiryDate", null);
            model.Product p = new model.Product(nextId, req.getInt("categoryId"), req.getString("name"), req.getInt("price"), null, null, intro, origin, productionDate, expiryDate);
            boolean ok = productDAO.save(p, req.getInt("categoryId"), imageList);
            if (ok) {
                sendJsonResponse(exchange, new JSONObject().put("id", nextId).toString(), 201);
            } else {
                sendErrorResponse(exchange, 500, "Failed to create product", null);
            }
        }

        private void handlePut(HttpExchange exchange, dao.ProductDAO productDAO) throws IOException, SQLException {
            try {
                String path = exchange.getRequestURI().getPath();
                int id = Integer.parseInt(path.substring(path.lastIndexOf('/') + 1));
                String body = readRequestBody(exchange, "");
                JSONObject req = new JSONObject(body);
                List<String> imageList = toStringList(req.optJSONArray("imageUrls"));
                String intro = req.optString("introduction", null);
                String origin = req.optString("origin", null);
                String productionDate = req.optString("productionDate", null);
                String expiryDate = req.optString("expiryDate", null);
                boolean ok = productDAO.update(id, req.optString("name", ""), req.optInt("price", 0), req.optInt("categoryId", 0), imageList, intro, origin, productionDate, expiryDate);
                if (ok) {
                    sendNoContent(exchange, 200);
                } else {
                    sendErrorResponse(exchange, 404, "Product not found for update", null);
                }
            } catch (NumberFormatException e) {
                sendErrorResponse(exchange, 400, "Invalid product ID format", e);
            }
        }

        private void handleDelete(HttpExchange exchange, dao.ProductDAO productDAO) throws IOException, SQLException {
            try {
                String path = exchange.getRequestURI().getPath();
                int id = Integer.parseInt(path.substring(path.lastIndexOf('/') + 1));
                if (productDAO.delete(id)) {
                    sendNoContent(exchange, 200);
                } else {
                    sendErrorResponse(exchange, 404, "Product not found for deletion", null);
                }
            } catch (NumberFormatException e) {
                sendErrorResponse(exchange, 400, "Invalid product ID format", e);
            }
        }
    }

    /**
     * 商品分類 CRUD API 處理器，覆蓋 /api/category 與 /api/categories。
     */
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
                    String body = readRequestBody(exchange, "");
                    JSONObject req = new JSONObject(body);
                    String name = req.optString("name", "").trim();
                    if (name.isEmpty()) {
                        sendErrorResponse(exchange, 400, "Missing 'name' for category", null);
                        return;
                    }
                    model.Category newCategory = new model.Category(0, name); // 主鍵由資料庫自動產生。
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
                        // 若路徑解析失敗，改由請求本文的欄位提供 id。
                    }
                    String body = readRequestBody(exchange, "");
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

    /**
     * 處理登入請求（/api/login），支援內建 admin 帳號與客戶驗證。
     */
    static class LoginHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                return;
            }
            try {
                String body = readRequestBody(exchange, "");
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

    /**
     * 處理 /api/customers 的 POST 請求，用於前端註冊新會員。
     * 只實作 POST（建立新會員），回傳 JSON { success: true, customerId, customerName }
     */
    static class CustomersHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                return;
            }
            try {
                String body = readRequestBody(exchange, "");
                // Debug: 印出收到的 request body 到 stderr，方便在不同 terminal 視窗中觀察
                System.err.println("[DEBUG] CustomersHandler received body: " + (body == null ? "<null>" : body));
                JSONObject req = new JSONObject(body);
                String name = req.optString("name", "").trim();
                String email = req.optString("email", "").trim();
                String password = req.optString("password", "").trim();
                String phone = req.has("phone") && !req.isNull("phone") ? req.optString("phone", null) : null;
                String address = req.has("address") && !req.isNull("address") ? req.optString("address", null) : null;
                String avatarUrl = req.has("avatarUrl") && !req.isNull("avatarUrl") ? req.optString("avatarUrl", null) : null;

                if (name.isEmpty() || email.isEmpty() || password.isEmpty()) {
                    sendErrorResponse(exchange, 400, "name, email and password are required", null);
                    return;
                }

                try (Connection conn = DBConnect.getConnection()) {
                    // 寫入前先檢查是否已有相同 Account（避免重複鍵）
                    try (PreparedStatement check = conn.prepareStatement("SELECT COUNT(*) FROM customers WHERE LOWER(Account)=LOWER(?)")) {
                        check.setString(1, email);
                        try (ResultSet crs = check.executeQuery()) {
                            if (crs.next() && crs.getInt(1) > 0) {
                                System.err.println("[INFO] Attempt to create existing account: " + email);
                                sendErrorResponse(exchange, 409, "Account already exists", null);
                                return;
                            }
                        }
                    } catch (SQLException ex) {
                        System.err.println("[WARN] Failed to perform pre-check for existing account: " + ex.getMessage());
                        // 不要因為 pre-check 失敗就停止註冊流程；繼續嘗試建立帳號，接著由後續的 INSERT 去處理可能的錯誤
                    }

                    // 使用 DAO.save 建立新使用者（DAO 會處理 insert 或 update，且在 insert 時回填自動產生的 id）
                    dao.CustomerDAO customerDAO = new dao.CustomerDAO(conn);
                    model.Customer newCustomer = new model.Customer(0, name, email, password, "");
                    System.err.println("[DEBUG] Creating customer (no-id) name=" + name + " account=" + email);
                    try {
                        boolean ok = customerDAO.save(newCustomer);
                        System.err.println("[DEBUG] customerDAO.save returned: " + ok + " newId=" + newCustomer.getId());
                        if (!ok) {
                            System.err.println("[ERROR] customerDAO.save failed to create customer record");
                            sendErrorResponse(exchange, 500, "Failed to create customer", null);
                            return;
                        }
                    } catch (java.sql.SQLException sqlEx) {
                        int errCode = sqlEx.getErrorCode();
                        String sqlState = sqlEx.getSQLState();
                        System.err.println("[ERROR] SQLException during customer save: code=" + errCode + " state=" + sqlState + " msg=" + sqlEx.getMessage());
                        if (errCode == 1062 || (sqlState != null && sqlState.startsWith("23"))) {
                            sendErrorResponse(exchange, 409, "Account already exists or constraint violation", sqlEx);
                            return;
                        }
                        sendErrorResponse(exchange, 500, "Failed to create customer due to database error", sqlEx);
                        return;
                    }

                    // 嘗試取得新建立的 id；若 DAO 未回填，回退到以 Account 查詢（最後手段）
                    int createdId = newCustomer.getId();
                    if (createdId <= 0) {
                        try (PreparedStatement getId = conn.prepareStatement("SELECT idCustomers FROM customers WHERE LOWER(Account)=LOWER(?) LIMIT 1")) {
                            getId.setString(1, email);
                            try (ResultSet grs = getId.executeQuery()) {
                                if (grs.next()) createdId = grs.getInt(1);
                            }
                        } catch (SQLException ex) {
                            System.err.println("[WARN] Failed to lookup created customer id by account: " + ex.getMessage());
                        }
                    }
                    if (createdId <= 0) {
                        sendErrorResponse(exchange, 500, "Failed to determine created customer id", null);
                        return;
                    }

                    // DAO.save 只會寫入 id, CustomerName, Account, PasswordHash, Salt；補寫 Email/Phone/Address/AvatarUrl/UpdatedAt
                    try (PreparedStatement ps = conn.prepareStatement("UPDATE customers SET Email=?, Phone=?, Address=?, AvatarUrl=?, UpdatedAt=NOW() WHERE idCustomers=?")) {
                        ps.setString(1, email);
                        ps.setString(2, phone);
                        ps.setString(3, address);
                        ps.setString(4, avatarUrl);
                        ps.setInt(5, createdId);
                        ps.executeUpdate();
                    } catch (Exception ex) {
                        // 非致命：已建立帳號，但無法更新額外欄位
                        System.err.println("Warning: failed to update extra customer fields: " + ex.getMessage());
                    }

                    JSONObject resp = new JSONObject();
                    resp.put("success", true);
                    resp.put("customerId", createdId);
                    resp.put("customerName", name);
                    sendJsonResponse(exchange, resp.toString(), 201);
                    return;
                }
            } catch (Exception e) {
                // 額外保險：先印出例外到 stderr，確保在任何情況下都有輸出
                System.err.println("[ERROR] Exception in CustomersHandler: " + e.getClass().getName() + ": " + e.getMessage());
                e.printStackTrace();
                sendErrorResponse(exchange, 500, "Failed to create customer", e);
            }
        }
    }

    /**
     * 處理前台與後台圖片上傳請求，將檔案儲存至 data/uploads/images。
     */
    static class ImageUploadHandler implements HttpHandler {

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

                // 清理檔名，避免目錄穿越等安全風險。
                fileName = fileName.replaceAll("[^a-zA-Z0-9._-]", "_");

                InputStream is = exchange.getRequestBody();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = is.read(buffer)) != -1) {
                    baos.write(buffer, 0, bytesRead);
                }
                byte[] fileContent = baos.toByteArray();

                String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
                String fileExtension = "";
                int dotIndex = fileName.lastIndexOf('.');
                if (dotIndex > 0) {
                    fileExtension = fileName.substring(dotIndex);
                }
                if (fileExtension.isEmpty()) {
                    if (contentType != null) {
                        String l = contentType.toLowerCase(java.util.Locale.ROOT);
                        if (l.contains("png")) fileExtension = ".png";
                        else if (l.contains("jpeg") || l.contains("jpg")) fileExtension = ".jpg";
                        else if (l.contains("gif")) fileExtension = ".gif";
                    }
                    if (fileExtension.isEmpty()) fileExtension = ".png";
                }

                String uniqueFilename = UUID.randomUUID().toString() + fileExtension;
                String effectiveContentType = (contentType == null || contentType.isEmpty()) ? "application/octet-stream" : contentType;
                // Allow client to request a specific prefix (e.g., uploads/hero)
                String uploadPrefix = null;
                String hdr = exchange.getRequestHeaders().getFirst("X-Upload-Prefix");
                if (hdr == null || hdr.trim().isEmpty()) hdr = exchange.getRequestHeaders().getFirst("x-upload-prefix");
                if (hdr != null && !hdr.trim().isEmpty()) uploadPrefix = hdr.trim();

                String imageUrl = null;

                if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                    try {
                        String objectKey = (uploadPrefix != null && !uploadPrefix.isEmpty()) ? R2_CLIENT.buildObjectKey(uniqueFilename, uploadPrefix) : R2_CLIENT.buildObjectKey(uniqueFilename);
                        CloudflareR2Client.UploadResult res = R2_CLIENT.uploadObject(objectKey, fileContent, effectiveContentType);
                        imageUrl = res.publicUrl();
                        System.err.println(java.time.LocalDateTime.now() + " - ImageUploadHandler: uploaded to R2 key=" + res.objectKey());
                    } catch (Exception r2Ex) {
                        System.err.println(java.time.LocalDateTime.now() + " - R2 upload failed, falling back to local disk: " + r2Ex.getMessage());
                    }
                }

                if (imageUrl == null) {
                    // If client requested hero prefix, save to HERO_UPLOADS_DIR; otherwise default to UPLOADS_DIR
                    Path targetDir = (uploadPrefix != null && uploadPrefix.toLowerCase().contains("hero")) ? HERO_UPLOADS_DIR : UPLOADS_DIR;
                    Files.createDirectories(targetDir);
                    Path filePath = targetDir.resolve(uniqueFilename);
                    Files.write(filePath, fileContent);
                    if (targetDir.equals(HERO_UPLOADS_DIR)) {
                        imageUrl = "/uploads/hero/" + uniqueFilename;
                    } else {
                        imageUrl = "/uploads/Carousel/" + uniqueFilename;
                    }
                    System.err.println(java.time.LocalDateTime.now() + " - ImageUploadHandler: saved " + filePath.toString() + " -> returning " + imageUrl);
                }

                JSONObject responseJson = new JSONObject();
                responseJson.put("imageUrl", imageUrl);
                sendJsonResponse(exchange, responseJson.toString(), 200);

            } catch (Exception e) {
                e.printStackTrace();
                sendErrorResponse(exchange, 500, "Internal Server Error during image upload", e);
            }
        }
    }

    /**
     * 負責刪除上傳或舊版目錄中的圖片，支援以 imageUrl 或 filename 指定檔案。
     */
    static class ImageDeleteHandler implements HttpHandler {
        private static final Path LEGACY_DIR = Paths.get("..", "frontend", "images", "products").toAbsolutePath().normalize();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                return;
            }
            String body = readRequestBody(exchange, "");
            try {
                JSONObject req = new JSONObject(body);
                String imageUrl = req.optString("imageUrl", null);
                String filename = req.optString("filename", null);
                if (imageUrl == null && filename == null) {
                    sendErrorResponse(exchange, 400, "Missing imageUrl or filename", null);
                    return;
                }

                if (imageUrl != null) {
                    String fromUrl = extractSanitizedFilename(imageUrl);
                    if (fromUrl != null) {
                        filename = fromUrl;
                    }
                }

                String sanitizedFilename = extractSanitizedFilename(filename);
                if (sanitizedFilename == null) {
                    sendErrorResponse(exchange, 400, "Invalid filename", null);
                    return;
                }
                filename = sanitizedFilename;
                boolean deleted = false;
                if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                    try {
                        String ref = imageUrl != null ? imageUrl : filename;
                        deleted = R2_CLIENT.deleteByReference(ref);
                    } catch (Exception e) {
                        System.err.println(java.time.LocalDateTime.now() + " - Failed to delete R2 object: " + e.getMessage());
                    }
                }
                if (!deleted) {
                    deleted = deleteFromLocalDirectories(filename, UPLOADS_DIR, AVATAR_UPLOADS_DIR, LEGACY_DIR);
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

    /**
     * 通用靜態檔案處理器，可服務指定目錄下的檔案，並支援 R2 重新導向作為備援。
     * 用於取代 ImageFileHandler, UploadsImageFileHandler, AvatarUploadsFileHandler, HeroUploadsFileHandler。
     */
    static class GenericFileHandler implements HttpHandler {
        private final Path baseDir;
        private final String urlPrefix;
        private final String notFoundMessage;

        public GenericFileHandler(Path baseDir, String urlPrefix, String notFoundMessage) {
            this.baseDir = baseDir;
            this.urlPrefix = (urlPrefix == null || urlPrefix.isBlank()) ? "" : urlPrefix;
            this.notFoundMessage = (notFoundMessage == null || notFoundMessage.isBlank()) ? "File not found" : notFoundMessage;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                String uriPath = exchange.getRequestURI().getPath();
                String fileName = uriPath.substring(uriPath.lastIndexOf('/') + 1);

                if (tryServeLocalFile(exchange, baseDir, fileName)) {
                    return;
                }

                String r2Ref = this.urlPrefix.isEmpty() ? uriPath : this.urlPrefix + fileName;
                if (tryRedirectToR2(exchange, uriPath, r2Ref)) {
                    return;
                }
                
                sendErrorResponse(exchange, 404, notFoundMessage + ": " + fileName, null);
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "Error serving file", e);
            }
        }
    }

    /**
     * API: 列舉 hero 圖庫（支援從 R2 或本機 hero 目錄取得檔案清單）。
     * GET /api/gallery/hero?prefix=uploads/hero
     */
    static class HeroGalleryApiHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendErrorResponse(exchange, 405, "Method Not Allowed", null);
                return;
            }
            try {
                String prefix = "uploads/hero";
                String q = exchange.getRequestURI().getQuery();
                if (q != null && !q.isEmpty()) {
                    String[] parts = q.split("&");
                    for (String p : parts) {
                        int eq = p.indexOf('=');
                        if (eq > 0) {
                            String k = p.substring(0, eq);
                            String v = p.substring(eq + 1);
                            if ("prefix".equalsIgnoreCase(k)) {
                                prefix = java.net.URLDecoder.decode(v, "UTF-8");
                            }
                        }
                    }
                }

                JSONArray out = new JSONArray();

                // Try R2 first for the requested prefix (default: uploads/hero)
                Set<String> seen = new HashSet<>();
                if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                    try {
                        List<String> keys = R2_CLIENT.listObjects(prefix);
                        for (String key : keys) {
                            if (key == null) continue;
                            String normalizedKey = key.replace('\\', '/').trim();
                            if (normalizedKey.isEmpty()) continue;
                            // skip directory-like keys (ending with '/') or the prefix itself
                            String pnorm = (prefix == null) ? "" : prefix.replaceAll("^/+", "").replaceAll("/+$", "");
                            if (normalizedKey.endsWith("/") || normalizedKey.equals(pnorm) || normalizedKey.equals(pnorm + "/")) continue;
                            // only include likely image files by extension
                            String lower = normalizedKey.toLowerCase();
                            if (!(lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.endsWith(".gif") || lower.endsWith(".svg"))) {
                                continue;
                            }
                            String url = R2_CLIENT.toPublicUrl(normalizedKey);
                            if (url != null && !seen.contains(url)) {
                                out.put(url);
                                seen.add(url);
                            }
                        }
                    } catch (Exception e) {
                        System.err.println(java.time.LocalDateTime.now() + " - HeroGalleryApiHandler R2 list failed for prefix=" + prefix + ": " + e.getMessage());
                    }
                }

                // Fallback to local hero uploads directory
                try {
                    if (Files.exists(HERO_UPLOADS_DIR) && Files.isDirectory(HERO_UPLOADS_DIR)) {
                        try (java.util.stream.Stream<Path> s = Files.list(HERO_UPLOADS_DIR)) {
                            s.filter(p -> Files.isRegularFile(p)).forEach(p -> {
                                String url = "/uploads/hero/" + p.getFileName().toString();
                                if (!seen.contains(url)) { out.put(url); seen.add(url); }
                            });
                        }
                    }
                } catch (Exception e) {
                    System.err.println(java.time.LocalDateTime.now() + " - HeroGalleryApiHandler local hero list failed: " + e.getMessage());
                }

                sendJsonResponse(exchange, out.toString(), 200);
            } catch (Exception e) {
                sendErrorResponse(exchange, 500, "Failed to list hero gallery", e);
            }
        }
    }

    /**
     * 一般靜態檔案處理器，支援根目錄與 /frontend 底下的 HTML/CSS/JS 讀取。
     */
    static class StaticHandler implements HttpHandler {
        private final Path baseDir;

        public StaticHandler() {
            baseDir = FRONTEND_DIR;
            System.err.println(java.time.LocalDateTime.now() + " - StaticHandler baseDir = " + baseDir.toString());
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String uriPath = exchange.getRequestURI().getPath();
            // 正規化常見的根目錄請求，讓 / 或 /frontend 轉向首頁。
            if (uriPath.equals("/") || uriPath.equals("/frontend") || uriPath.equals("/frontend/")) {
                uriPath = "/frontend/client/index.html";
            }

            // 如果路徑以 /frontend 起頭，就直接以 baseDir 為根目錄解析。
            Path resolved = null;
            if (uriPath.startsWith("/frontend")) {
                String rel = uriPath.substring("/frontend".length());
                resolved = baseDir.resolve(rel.substring(1)).normalize();
            } else {
                // 先嘗試在 baseDir 下尋找同名檔案（如 /frontend/client/cart.html 會於前段處理），
                // 若是根目錄請求（例：/cart.html）則改映射到 frontend/client/<檔名>。
                String candidatePath = uriPath.startsWith("/") ? uriPath.substring(1) : uriPath;
                Path direct = baseDir.resolve(candidatePath).normalize();
                if (Files.exists(direct) && direct.startsWith(baseDir) && Files.isReadable(direct)) {
                    resolved = direct;
                } else {
                    // 最後備援：轉向 frontend/client/<檔名> 掃描實際檔案。
                    Path clientCandidate = baseDir.resolve("client").resolve(candidatePath).normalize();
                    if (Files.exists(clientCandidate) && clientCandidate.startsWith(baseDir) && Files.isReadable(clientCandidate)) {
                        resolved = clientCandidate;
                    }
                }
            }

            if (resolved == null || !resolved.startsWith(baseDir) || !Files.exists(resolved) || !Files.isReadable(resolved)) {
                String fallbackName = null;
                int idx = uriPath.lastIndexOf('/') + 1;
                if (idx > 0 && idx < uriPath.length()) fallbackName = uriPath.substring(idx);
                if (fallbackName != null && !fallbackName.isEmpty()) {
                        if (tryServeLocalFile(exchange, UPLOADS_DIR, fallbackName)) return;
                        if (tryServeLocalFile(exchange, AVATAR_UPLOADS_DIR, fallbackName)) return;
                        if (tryRedirectToR2(exchange,
                            "/uploads/Carousel/" + fallbackName,
                            "/uploads/avatar/" + fallbackName)) {
                        return;
                    }
                }
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

    // 輪播資料儲存：站內各頁共用 carousel.json。
    /**
     * 管理首頁輪播資料（data/carousel.json）的讀寫。
     */
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
                    JSONArray normalized = new JSONArray();
                    boolean normalizedSuccessfully = true;
                    try {
                        JSONArray arr = new JSONArray(json);
                        for (int i = 0; i < arr.length(); i++) {
                            Object item = arr.get(i);
                            if (!(item instanceof JSONObject)) {
                                continue;
                            }
                            JSONObject slide = new JSONObject(((JSONObject) item).toString());
                            String raw = slide.optString("imageUrl", null);
                            String resolved = normalizeImageUrl(raw);
                            if (raw == null) {
                                slide.put("imageUrl", "");
                            }
                            if (resolved != null) {
                                slide.put("imageUrlResolved", resolved);
                                if (raw != null && !raw.isEmpty() && !raw.equals(resolved)) {
                                    slide.put("imageUrlOriginal", raw);
                                }
                                slide.remove("imageMissing");
                            } else {
                                // If resolution fails, do not force a server-side placeholder.
                                // Leave imageUrlResolved empty and indicate missing so frontend can apply its own fallback or gallery logic.
                                slide.put("imageUrlResolved", "");
                                if (raw != null && !raw.isEmpty()) {
                                    slide.put("imageUrlOriginal", raw);
                                }
                                slide.put("imageMissing", true);
                            }
                            normalized.put(slide);
                        }
                    } catch (Exception parseEx) {
                        normalizedSuccessfully = false;
                        System.err.println("CarouselHandler: failed to normalize carousel data: " + parseEx.getMessage());
                    }
                    if (normalizedSuccessfully) {
                        // 如果已解析的輪播資料沒有任何可用的圖片，嘗試從 R2 的 uploads/Carousel 前綴取得圖片作為 fallback
                        boolean hasImage = false;
                        for (int i = 0; i < normalized.length(); i++) {
                            JSONObject s = normalized.optJSONObject(i);
                            if (s != null) {
                                String resolved = s.optString("imageUrlResolved", "");
                                if (resolved != null && !resolved.trim().isEmpty()) { hasImage = true; break; }
                            }
                        }
                        if (!hasImage && R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                            try {
                                List<String> keys = R2_CLIENT.listObjects("uploads/Carousel");
                                JSONArray gallerySlides = new JSONArray();
                                Set<String> seen = new HashSet<>();
                                for (String key : keys) {
                                    if (key == null) continue;
                                    String nk = key.replace('\\', '/').trim();
                                    if (nk.isEmpty()) continue;
                                    if (nk.endsWith("/")) continue;
                                    String lower = nk.toLowerCase();
                                    if (!(lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.endsWith(".gif") || lower.endsWith(".svg"))) continue;
                                    String url = R2_CLIENT.toPublicUrl(nk);
                                    if (url == null || seen.contains(url)) continue;
                                    JSONObject slide = new JSONObject();
                                    slide.put("imageUrlResolved", url);
                                    slide.put("imageUrl", JSONObject.NULL);
                                    slide.put("title", "");
                                    slide.put("text", "");
                                    slide.put("link", "");
                                    gallerySlides.put(slide);
                                    seen.add(url);
                                }
                                if (gallerySlides.length() > 0) {
                                    sendJsonResponse(exchange, gallerySlides.toString(), 200);
                                    return;
                                }
                            } catch (Exception e) {
                                System.err.println(java.time.LocalDateTime.now() + " - CarouselHandler R2 fallback failed: " + e.getMessage());
                            }
                        }
                        sendJsonResponse(exchange, normalized.toString(), 200);
                    } else {
                        sendJsonResponse(exchange, json, 200);
                    }
                } else if ("PUT".equalsIgnoreCase(method) || "POST".equalsIgnoreCase(method)) {
                    String body = readRequestBody(exchange, "[]");
                    // 驗證輸入內容確實為 JSON 陣列格式。
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

    // 站台設定：涵蓋主視覺、優勢、精選商品與頁尾資訊。
    /**
     * 管理站台設定（data/site-config.json）的讀寫與預設值載入。
     */
    static class SiteConfigHandler implements HttpHandler {
        private static final Path CONFIG_FILE = DATA_DIR.resolve("site-config.json");

        private static boolean isBlank(String value) {
            return value == null || value.trim().isEmpty() || "null".equalsIgnoreCase(value.trim());
        }

        private static String sanitizeHeroImageReference(String value) {
            if (isBlank(value)) return null;
            String trimmed = value.trim().replace('\\', '/');
            if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
                return trimmed;
            }
            String sanitized = trimmed
                    .replaceFirst("^/api(?=/uploads/)", "")
                    .replaceFirst("^api(?=/uploads/)", "")
                    .replaceFirst("^\\./(?=uploads/)", "/")
                    .replaceFirst("^/{2,}(?=uploads/)", "/");
            if (!sanitized.startsWith("/")) {
                sanitized = "/" + sanitized.replaceFirst("^/+", "");
            }
            return sanitized;
        }

        private static String resolveHeroImageUrl(String sanitized) {
            if (isBlank(sanitized)) return null;
            String resolved = normalizeImageUrl(sanitized);
            if (!isBlank(resolved)) {
                return resolved;
            }
            return sanitized;
        }

        /**
         * 讀取指定檔案內容，若不存在則回傳預設 JSON 字串。
         * @param path 設定檔路徑。
         * @param defaultJson 檔案不存在時使用的預設內容。
         * @return 檔案內容或預設字串。
         * @throws IOException 讀檔失敗時拋出。
         */
        private static String readFileOrDefault(Path path, String defaultJson) throws IOException {
            if (!Files.exists(path)) return defaultJson;
            return Files.readString(path, java.nio.charset.StandardCharsets.UTF_8);
        }

        /**
         * 將 JSON 字串寫入指定檔案，必要時建立目錄。
         * @param path 目標檔案路徑。
         * @param json 要儲存的內容。
         * @throws IOException 寫檔失敗時拋出。
         */
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
                        .put("imageUrl", "")
                        .put("primaryText", "開始購物")
                        .put("primaryLink", "product.html")
                        .put("secondaryText", "逛逛全部")
                        .put("secondaryLink", "product.html?category=all"))
                .put("benefits", new JSONArray()
                        .put(new JSONObject().put("icon", "truck-fast").put("title", "快速到貨").put("desc", "下單 24 小時內出貨"))
                        .put(new JSONObject().put("icon", "shield-halved").put("title", "安全付款").put("desc", "多元支付、SSL 安全"))
                        .put(new JSONObject().put("icon", "arrows-rotate").put("title", "七日鑑賞").put("desc", "不滿意可退換"))
                        .put(new JSONObject().put("icon", "gift").put("title", "會員回饋").put("desc", "點數折抵更划算")))
        .put("promotions", new JSONArray()
            .put(new JSONObject().put("text", "全館滿 NT$999 免運").put("link", "product.html"))
            .put(new JSONObject().put("text", "加入會員立即享 95 折優惠").put("link", "member.html"))
            .put(new JSONObject().put("text", "最新上架零食！把握限量好味道").put("link", "product.html?category=all")))
        .put("support", new JSONObject()
            .put("email", "snackforest1688@gmail.com")
            .put("phone", "0909-585-898")
            .put("hours", "週一至週五 09:00 - 18:00")
            .put("liveChatUrl", "")
            .put("liveChatLabel", ""))
                .put("featuredProductIds", new JSONArray())
                .toString();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            try {
                if ("GET".equalsIgnoreCase(method)) {
                    String json = readFileOrDefault(CONFIG_FILE, DEFAULT_CONFIG);
                    JSONObject payload;
                    try {
                        payload = new JSONObject(json);
                    } catch (Exception ex) {
                        System.err.println("SiteConfigHandler: invalid JSON, returning defaults: " + ex.getMessage());
                        payload = new JSONObject(DEFAULT_CONFIG);
                    }

                    JSONObject hero = payload.optJSONObject("hero");
                    if (hero != null) {
                        String raw = hero.optString("imageUrl", null);
                        String sanitized = sanitizeHeroImageReference(raw);
                        if (sanitized != null) {
                            hero.put("imageUrl", sanitized);
                        } else {
                            hero.put("imageUrl", JSONObject.NULL);
                        }

                        if (sanitized != null && raw != null && !raw.equals(sanitized)) {
                            hero.put("imageUrlOriginal", raw);
                        } else {
                            hero.remove("imageUrlOriginal");
                        }

                        String resolved = resolveHeroImageUrl(sanitized);
                        if (!isBlank(resolved)) {
                            hero.put("imageUrlResolved", resolved);
                            hero.remove("imageMissing");
                        } else {
                            hero.put("imageUrlResolved", JSONObject.NULL);
                            hero.put("imageMissing", true);
                        }
                    }

                    sendJsonResponse(exchange, payload.toString(), 200);
                } else if ("PUT".equalsIgnoreCase(method) || "POST".equalsIgnoreCase(method)) {
                    String body = readRequestBody(exchange, DEFAULT_CONFIG);
                    // 驗證上傳內容為合法的 JSON 物件。
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

    // 顧客檔案 API：支援 GET /api/customer-profile/{id} 與 PUT 同一路徑。
    /**
     * 處理顧客檔案的取得與更新（/api/customer-profile/{id}）。
     */
    static class CustomerProfileHandler implements HttpHandler {
        private static final Path PROFILES_FILE = DATA_DIR.resolve("customer-profiles.json");

    /**
     * 讀取顧客檔案 JSON 資料，若檔案不存在或解析失敗則回傳空物件。
     * @return 代表所有顧客資料的 JSONObject。
     */
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

    /**
     * 將顧客檔案 JSON 寫回磁碟，必要時建立目錄。
     * @param obj 要儲存的顧客資料集合。
     * @throws IOException 寫檔失敗時拋出。
     */
    private static void writeProfiles(JSONObject obj) throws IOException {
            Files.createDirectories(PROFILES_FILE.getParent());
            Files.writeString(PROFILES_FILE, obj.toString(), java.nio.charset.StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);
        }

    /**
     * 依顧客編號查詢資料庫的顧客姓名，用於補強檔案資料缺漏。
     * @param id 顧客 ID。
     * @return 顧客姓名，若查無則回傳空字串。
     */
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

    /**
     * 根據檔名或 Content-Type 推測適當的副檔名，預設為 .png。
     * @param fileName 上傳時提供的檔名。
     * @param contentType HTTP Content-Type。
     * @return 合適的副檔名。
     */
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

        // 資料庫欄位補強已由外層 Server.ensureCustomerColumns 處理，這裡不再重複。

            private static boolean isNullOrEmpty(String value) {
                return value == null || value.trim().isEmpty() || "null".equalsIgnoreCase(value.trim());
            }

            private static boolean isLocalHost(String host) {
                if (host == null) return false;
                String lowered = host.toLowerCase(Locale.ROOT);
                return "localhost".equals(lowered) || "127.0.0.1".equals(lowered) || "::1".equals(lowered);
            }

            private static String sanitizeRelativeAvatarPath(String value) {
                if (value == null) return null;
                String trimmed = value.trim().replace('\\', '/');
                if (trimmed.isEmpty()) return null;
                int queryIndex = trimmed.indexOf('?');
                if (queryIndex >= 0) {
                    trimmed = trimmed.substring(0, queryIndex);
                }
                int fragmentIndex = trimmed.indexOf('#');
                if (fragmentIndex >= 0) {
                    trimmed = trimmed.substring(0, fragmentIndex);
                }
                if (trimmed.startsWith("/api/uploads/")) trimmed = trimmed.substring(4);
                else if (trimmed.startsWith("api/uploads/")) trimmed = trimmed.substring(3);
                if (trimmed.startsWith("./uploads/")) trimmed = trimmed.substring(1);
                while (trimmed.startsWith("//")) {
                    trimmed = trimmed.substring(1);
                }
                if (!trimmed.startsWith("/")) {
                    trimmed = "/" + trimmed;
                }
                return trimmed;
            }

            private static String relocateAvatarPathIfAvailable(String value) {
                if (value == null) return null;
                String trimmed = value.trim().replace('\\', '/');
                final String legacyPrefix = "/uploads/Carousel/";
                final String avatarPrefix = "/uploads/avatar/";
                if (!trimmed.startsWith(legacyPrefix)) return trimmed;
                String filename = trimmed.substring(legacyPrefix.length());
                if (filename.isEmpty()) return trimmed;

                Path avatarCandidate = AVATAR_UPLOADS_DIR.resolve(filename).normalize();
                if (avatarCandidate.startsWith(AVATAR_UPLOADS_DIR) && Files.exists(avatarCandidate) && Files.isRegularFile(avatarCandidate)) {
                    return avatarPrefix + filename;
                }

                if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                    String remote = R2_CLIENT.toPublicUrl(avatarPrefix + filename);
                    if (remote != null && CloudflareR2Client.headExists(remote)) {
                        return avatarPrefix + filename;
                    }
                }

                Path legacyCandidate = UPLOADS_DIR.resolve(filename).normalize();
                if (legacyCandidate.startsWith(UPLOADS_DIR) && Files.exists(legacyCandidate) && Files.isRegularFile(legacyCandidate)) {
                    return trimmed;
                }

                if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                    String legacyRemote = R2_CLIENT.toPublicUrl(trimmed);
                    if (legacyRemote != null && CloudflareR2Client.headExists(legacyRemote)) {
                        return trimmed;
                    }
                }

                return null;
            }

            private static String canonicalizeAvatarForStorage(String value, HttpExchange exchange) {
                if (isNullOrEmpty(value)) return null;
                String trimmed = value.trim().replace('\\', '/');
                if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                    if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                        String r2Relative = R2_CLIENT.toRelativePath(trimmed);
                        if (!isNullOrEmpty(r2Relative)) {
                            return relocateAvatarPathIfAvailable(sanitizeRelativeAvatarPath(r2Relative));
                        }
                    }
                    try {
                        URI uri = new URI(trimmed);
                        String host = uri.getHost();
                        if (host != null) {
                            String hostLower = host.toLowerCase(Locale.ROOT);
                            String hostHeader = exchange.getRequestHeaders().getFirst("Host");
                            String requestHost = hostHeader != null ? hostHeader.split(":")[0].toLowerCase(Locale.ROOT) : "";
                            if (isLocalHost(hostLower) || (!requestHost.isEmpty() && hostLower.equals(requestHost))) {
                                String path = uri.getPath();
                                if (path == null || path.isEmpty()) {
                                    path = "/";
                                }
                                return relocateAvatarPathIfAvailable(sanitizeRelativeAvatarPath(path));
                            }
                        }
                        return trimmed;
                    } catch (URISyntaxException ignored) {
                        return trimmed;
                    }
                }
                return relocateAvatarPathIfAvailable(sanitizeRelativeAvatarPath(trimmed));
            }

            private static String optStringOrNull(JSONObject obj, String key) {
                if (obj == null || key == null || !obj.has(key) || obj.isNull(key)) {
                    return null;
                }
                String value = obj.optString(key, null);
                return isNullOrEmpty(value) ? null : value;
            }

            private static String normalizeAvatarFields(JSONObject target, HttpExchange exchange, String rawOverride) {
                String rawValue = rawOverride;
                if (isNullOrEmpty(rawValue)) {
                    rawValue = optStringOrNull(target, "avatarUrl");
                }

                if (isNullOrEmpty(rawValue)) {
                    target.put("avatarUrl", JSONObject.NULL);
                    target.remove("avatarUrlOriginal");
                    target.put("avatarUrlResolved", JSONObject.NULL);
                    target.remove("avatarMissing");
                    return null;
                }

                String canonical = canonicalizeAvatarForStorage(rawValue, exchange);
                if (!isNullOrEmpty(canonical)) {
                    target.put("avatarUrl", canonical);
                    if (!canonical.equals(rawValue)) {
                        target.put("avatarUrlOriginal", rawValue);
                    } else {
                        target.remove("avatarUrlOriginal");
                    }
                    String resolved = resolveAvatarReference(canonical, exchange);
                    if (!isNullOrEmpty(resolved)) {
                        target.put("avatarUrlResolved", resolved);
                        target.remove("avatarMissing");
                    } else {
                        target.put("avatarUrlResolved", JSONObject.NULL);
                        target.put("avatarMissing", true);
                    }
                    return canonical;
                }

                target.put("avatarUrl", JSONObject.NULL);
                target.remove("avatarUrlOriginal");

                String resolvedFallback = null;
                if (rawValue.startsWith("http://") || rawValue.startsWith("https://")) {
                    resolvedFallback = resolveAvatarReference(rawValue, exchange);
                }
                if (!isNullOrEmpty(resolvedFallback)) {
                    target.put("avatarUrlResolved", resolvedFallback);
                    target.remove("avatarMissing");
                } else {
                    target.put("avatarUrlResolved", JSONObject.NULL);
                    target.put("avatarMissing", true);
                }

                return null;
            }

            private static String buildAbsoluteUrl(String path, HttpExchange exchange) {
                if (isNullOrEmpty(path)) return null;
                String normalized = path.trim();
                if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
                    return normalized;
                }
                if (!normalized.startsWith("/")) {
                    normalized = "/" + normalized.replaceFirst("^/+", "");
                }

                String scheme = "http";
                String forwardedProto = exchange.getRequestHeaders().getFirst("X-Forwarded-Proto");
                if (!isNullOrEmpty(forwardedProto)) {
                    scheme = forwardedProto.split(",")[0].trim();
                } else if (exchange.getLocalAddress().getPort() == 443) {
                    scheme = "https";
                }

                String host = exchange.getRequestHeaders().getFirst("X-Forwarded-Host");
                if (isNullOrEmpty(host)) {
                    host = exchange.getRequestHeaders().getFirst("Host");
                }
                if (isNullOrEmpty(host)) {
                    InetSocketAddress addr = exchange.getLocalAddress();
                    StringBuilder sb = new StringBuilder(addr.getHostString());
                    int port = addr.getPort();
                    if (port != 80 && port != 443) {
                        sb.append(':').append(port);
                    }
                    host = sb.toString();
                }
                host = host.trim();
                while (host.endsWith("/")) {
                    host = host.substring(0, host.length() - 1);
                }

                return scheme + "://" + host + normalized;
            }

            private static String resolveAvatarReference(String storedValue, HttpExchange exchange) {
                if (isNullOrEmpty(storedValue)) return null;
                String normalized = normalizeImageUrl(storedValue);
                if (isNullOrEmpty(normalized)) {
                    normalized = storedValue;
                }
                String absoluteUrl = buildAbsoluteUrl(normalized, exchange);
                if (absoluteUrl == null) return null;

                String timestamp = ZonedDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ISO_INSTANT);
                String fragment = "";
                int hashIndex = absoluteUrl.indexOf('#');
                if (hashIndex >= 0) {
                    fragment = absoluteUrl.substring(hashIndex);
                    absoluteUrl = absoluteUrl.substring(0, hashIndex);
                }

                String cleaned = absoluteUrl.replaceAll("(?i)([?&])v=[^&]*", "$1");
                cleaned = cleaned.replaceAll("\\?&", "?");
                cleaned = cleaned.replaceAll("&&", "&");
                if (cleaned.endsWith("?")) {
                    cleaned = cleaned.substring(0, cleaned.length() - 1);
                }
                if (cleaned.endsWith("&")) {
                    cleaned = cleaned.substring(0, cleaned.length() - 1);
                }

                String separator = cleaned.contains("?") ? "&" : "?";
                String cacheToken = URLEncoder.encode(timestamp, StandardCharsets.UTF_8);
                return cleaned + separator + "v=" + cacheToken + fragment;
            }

            private static void deleteAvatarFile(String avatarUrl) {
                if (isNullOrEmpty(avatarUrl)) {
                    return;
                }

                boolean deleted = false;
                try {
                    if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                        deleted = R2_CLIENT.deleteByReference(avatarUrl);
                    }

                    if (!deleted) {
                        String normalizedPath = sanitizeRelativeAvatarPath(avatarUrl);
                        if (normalizedPath != null && (normalizedPath.startsWith("/uploads/") || normalizedPath.startsWith("uploads/"))) {
                            String filename = extractSanitizedFilename(normalizedPath);
                            if (filename != null) {
                                deleted = deleteFromLocalDirectories(filename, AVATAR_UPLOADS_DIR, UPLOADS_DIR);
                            }
                        }
                    }

                    if (deleted) {
                        System.err.println(java.time.LocalDateTime.now() + " - Deleted old avatar: " + avatarUrl);
                    }
                } catch (Exception e) {
                    System.err.println(java.time.LocalDateTime.now() + " - Failed to delete old avatar file '" + avatarUrl + "': " + e.getMessage());
                }
            }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();
            // 預期路徑格式為 /api/customer-profile/{id}
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

                // 將檔案內容與資料庫欄位合併，資料庫值若存在則具有優先權。
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
                                if (avatar != null && !avatar.trim().isEmpty() && !"null".equalsIgnoreCase(avatar.trim())) {
                                    profile.put("avatarUrl", avatar);
                                } else if (!profile.has("avatarUrl")) {
                                    profile.put("avatarUrl", JSONObject.NULL);
                                }
                                if (updated != null) profile.put("updatedAt", updated.toInstant().toString());
                            } else {
                                    // 若資料庫沒有該筆紀錄，盡量帶入先前保存的名稱作為備援。
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

                normalizeAvatarFields(profile, exchange, null);

                sendJsonResponse(exchange, profile.toString(), 200);
                return;
            }

            if ("PUT".equalsIgnoreCase(method)) {
                String body = readRequestBody(exchange, "{}");
                JSONObject req;
                try { req = new JSONObject(body); } catch (Exception e) {
                    sendErrorResponse(exchange, 400, "Invalid JSON", e);
                    return;
                }

                JSONObject store = readProfiles();
                JSONObject existing = store.optJSONObject(String.valueOf(id));
                if (existing == null) existing = new JSONObject();

                String previousStoredAvatar = optStringOrNull(existing, "avatarUrl");
                String requestedAvatarValue = previousStoredAvatar;

                boolean avatarRemoveRequested = false;
                if (req.has("removeAvatar")) {
                    avatarRemoveRequested = req.optBoolean("removeAvatar", false);
                } else if (req.has("avatarRemove")) {
                    avatarRemoveRequested = req.optBoolean("avatarRemove", false);
                } else if (req.has("avatarUrl")) {
                    if (req.isNull("avatarUrl")) {
                        avatarRemoveRequested = true;
                    } else {
                        String avatarUrlValue = req.optString("avatarUrl", "");
                        if (isNullOrEmpty(avatarUrlValue)) {
                            avatarRemoveRequested = true;
                        }
                    }
                }

                // 合併可更新的欄位值，僅覆寫使用者透過表單提交的內容。
                String displayName = req.optString("displayName", null);
                String email = req.optString("email", null);
                String phone = req.optString("phone", null);
                String address = req.optString("address", null);

                if (displayName != null && !displayName.isEmpty()) existing.put("displayName", displayName);
                if (email != null) existing.put("email", email.isEmpty() ? JSONObject.NULL : email);
                if (phone != null) existing.put("phone", phone.isEmpty() ? JSONObject.NULL : phone);
                if (address != null) existing.put("address", address.isEmpty() ? JSONObject.NULL : address);

                // 若請求內帶有頭像資料，將 base64 內容解碼並儲存成檔案。
                String avatarData = req.optString("avatarData", null);
                String avatarFileName = req.optString("avatarFileName", null);
                String avatarContentType = req.optString("avatarContentType", null);
                boolean avatarUploaded = false;
                boolean avatarCleared = false;
                String uploadedAvatarRaw = null;
                if (avatarData != null && !avatarData.isEmpty()) {
                    try {
                        byte[] bytes = java.util.Base64.getDecoder().decode(avatarData);
                        String ext = inferExtension(avatarFileName, avatarContentType);
                        String unique = "customer-" + id + "-" + System.currentTimeMillis() + ext;
                        String relativePath = "uploads/avatar/" + unique;
                        String localUrl = "/" + relativePath;

                        String effectiveContentType = (avatarContentType == null || avatarContentType.isEmpty()) ? "application/octet-stream" : avatarContentType;

                        // 先嘗試上傳到 Cloudflare R2，成功則使用公開網址作為頭像位置。
                        if (R2_CLIENT != null && R2_CLIENT.isConfigured()) {
                            try {
                                String objectKey = R2_CLIENT.buildObjectKey(unique, "uploads/avatar");
                                CloudflareR2Client.UploadResult uploadRes = R2_CLIENT.uploadObject(objectKey, bytes, effectiveContentType);
                                uploadedAvatarRaw = uploadRes.publicUrl();
                                System.err.println(java.time.LocalDateTime.now() + " - CustomerProfileHandler: uploaded avatar to R2 key=" + uploadRes.objectKey());
                            } catch (Exception r2ex) {
                                System.err.println("Failed to upload avatar to R2, falling back to local disk: " + r2ex.getMessage());
                            }
                        }

                        // 若 R2 上傳未成功，改存成本機檔案，並回傳相對位址。
                        if (uploadedAvatarRaw == null) {
                            Files.createDirectories(AVATAR_UPLOADS_DIR);
                            Path target = AVATAR_UPLOADS_DIR.resolve(unique).normalize();
                            if (!target.startsWith(AVATAR_UPLOADS_DIR)) throw new IOException("Invalid upload path");
                            Files.write(target, bytes);
                            uploadedAvatarRaw = localUrl;
                        }
                    } catch (Exception e) {
                        System.err.println("Failed to save avatar: " + e.getMessage());
                        // 若儲存失敗，保留舊有頭像以免造成斷圖。
                    }
                }

                if (!isNullOrEmpty(uploadedAvatarRaw)) {
                    requestedAvatarValue = uploadedAvatarRaw;
                    avatarUploaded = true;
                }

                if (avatarRemoveRequested) {
                    requestedAvatarValue = null;
                    avatarCleared = true;
                    System.err.println(java.time.LocalDateTime.now() + " - CustomerProfileHandler: cleared avatar for customer " + id + " by request");
                }

                String canonicalAvatar = normalizeAvatarFields(existing, exchange, requestedAvatarValue);

                // 如果 normalizeAvatarFields 沒有回傳 canonicalAvatar（可能因為暫時性檔案可見性或其他原因），
                // 但我們剛剛確定 avatarUploaded 為 true，則嘗試以 uploadedAvatarRaw 建立 canonical 與 resolved，
                // 並回填 existing 與 canonicalAvatar，確保 API 回應中包含可用的 avatar 欄位。
                if (isNullOrEmpty(canonicalAvatar) && avatarUploaded && !isNullOrEmpty(uploadedAvatarRaw)) {
                    try {
                        // 先嘗試 canonicalize uploaded raw reference
                        String tryCanonical = canonicalizeAvatarForStorage(uploadedAvatarRaw, exchange);
                        if (!isNullOrEmpty(tryCanonical)) {
                            canonicalAvatar = tryCanonical;
                            existing.put("avatarUrl", canonicalAvatar);
                            String resolved = resolveAvatarReference(canonicalAvatar, exchange);
                            if (!isNullOrEmpty(resolved)) {
                                existing.put("avatarUrlResolved", resolved);
                                existing.remove("avatarMissing");
                            } else {
                                existing.put("avatarUrlResolved", JSONObject.NULL);
                                existing.put("avatarMissing", true);
                            }
                        } else {
                            // 無法 canonicalize，至少把上傳原始路徑放回 existing，並嘗試以此產生 resolved
                            existing.put("avatarUrl", uploadedAvatarRaw);
                            String resolved = resolveAvatarReference(uploadedAvatarRaw, exchange);
                            if (!isNullOrEmpty(resolved)) {
                                existing.put("avatarUrlResolved", resolved);
                                existing.remove("avatarMissing");
                            } else {
                                existing.put("avatarUrlResolved", JSONObject.NULL);
                                existing.put("avatarMissing", true);
                            }
                        }
                    } catch (Exception e) {
                        System.err.println("CustomerProfileHandler: fallback canonicalization failed: " + e.getMessage());
                    }
                }

                if (avatarUploaded && !isNullOrEmpty(canonicalAvatar) && !isNullOrEmpty(requestedAvatarValue)) {
                    System.err.println(java.time.LocalDateTime.now() + " - CustomerProfileHandler: stored avatar for customer " + id + " -> " + canonicalAvatar + " (original=" + requestedAvatarValue + ")");
                } else if (!avatarUploaded && !avatarCleared && !isNullOrEmpty(canonicalAvatar)
                        && previousStoredAvatar != null && !previousStoredAvatar.equals(canonicalAvatar)) {
                    System.err.println(java.time.LocalDateTime.now() + " - CustomerProfileHandler: normalized existing avatar for customer " + id + " -> " + canonicalAvatar);
                }

                // 如果剛剛上傳成功但 normalizeAvatarFields 未能產生可用的 avatarUrlResolved，
                // 嘗試直接以 upload 回傳的值建立 resolved URL，避免前端收到 null
                if (avatarUploaded) {
                    try {
                        String existingResolved = optStringOrNull(existing, "avatarUrlResolved");
                        if (isNullOrEmpty(existingResolved)) {
                            String resolvedDirect = resolveAvatarReference(uploadedAvatarRaw, exchange);
                            if (!isNullOrEmpty(resolvedDirect)) {
                                existing.put("avatarUrlResolved", resolvedDirect);
                                existing.remove("avatarMissing");
                            } else {
                                existing.put("avatarUrlResolved", JSONObject.NULL);
                                existing.put("avatarMissing", true);
                            }
                        }
                        if (!existing.has("avatarUrl") || existing.isNull("avatarUrl")) {
                            existing.put("avatarUrl", uploadedAvatarRaw);
                        }
                    } catch (Exception e) {
                        System.err.println("CustomerProfileHandler: post-process avatar resolution failed: " + e.getMessage());
                    }
                }

                String currentStoredAvatar = optStringOrNull(existing, "avatarUrl");

                if (previousStoredAvatar != null) {
                    boolean avatarPathChanged = currentStoredAvatar == null || !previousStoredAvatar.equals(currentStoredAvatar);
                    if ((avatarUploaded || avatarCleared) && avatarPathChanged) {
                        String candidate = canonicalizeAvatarForStorage(previousStoredAvatar, exchange);
                        if (isNullOrEmpty(candidate)) {
                            candidate = previousStoredAvatar;
                        }
                        deleteAvatarFile(candidate);
                    }
                }

                existing.put("customerId", String.valueOf(id));
                existing.put("updatedAt", java.time.Instant.now().toString());
                store.put(String.valueOf(id), existing);
                writeProfiles(store);

                // 將同樣資料同步寫回 customers 資料表，維持前台/後台資料一致。
                try (Connection conn = DBConnect.getConnection()) {
                    Server.ensureCustomerColumns(conn);
                    String sql = "UPDATE customers SET CustomerName = COALESCE(?, CustomerName), " +
                            "Email = ?, Phone = ?, Address = ?, AvatarUrl = ?, UpdatedAt = NOW() WHERE idCustomers = ?";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        ps.setString(1, displayName);
                        ps.setString(2, email);
                        ps.setString(3, phone);
                        ps.setString(4, address);
                        if (isNullOrEmpty(canonicalAvatar)) {
                            ps.setNull(5, Types.VARCHAR);
                        } else {
                            ps.setString(5, canonicalAvatar);
                        }
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

    // Footer SVG generator removed — footer features cleaned up.
}
