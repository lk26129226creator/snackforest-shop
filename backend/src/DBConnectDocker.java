import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * 資料庫連線工具類別 DBConnect（支援環境變數配置）
 */
public class DBConnectDocker {
    // 從環境變數讀取資料庫配置，如果沒有則使用預設值
    private static final String DB_HOST = System.getenv().getOrDefault("DB_HOST", "localhost");
    private static final String DB_PORT = System.getenv().getOrDefault("DB_PORT", "3306");
    private static final String DB_NAME = System.getenv().getOrDefault("DB_NAME", "test0310");
    private static final String DB_USER = System.getenv().getOrDefault("DB_USER", "root");
    private static final String DB_PASSWORD = System.getenv().getOrDefault("DB_PASSWORD", "lkjh890612");
    
    private static final String URL = String.format(
        "jdbc:mysql://%s:%s/%s?autoReconnect=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8",
        DB_HOST, DB_PORT, DB_NAME
    );

    static {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            System.out.println("MySQL Driver loaded successfully");
            System.out.println("Connecting to: " + DB_HOST + ":" + DB_PORT + "/" + DB_NAME);
        } catch (ClassNotFoundException e) {
            throw new RuntimeException("FATAL: 找不到 MySQL JDBC 驅動程式。", e);
        }
    }

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, DB_USER, DB_PASSWORD);
    }

    public static void main(String[] args) {
        try (Connection conn = DBConnectDocker.getConnection()) {
            System.out.println("✅ 成功連接 MySQL！");
        } catch (Exception e) {
            System.err.println("❌ 連線測試失敗：" + e.getMessage());
            e.printStackTrace();
        }
    }
}