import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * 資料庫連線工具類別 DBConnect（放在預設 package，與專案其他檔案一致）
 */
public class DBConnect {
    // MySQL 連線資訊（支援環境變數，保留預設值以支援本機開發）
    private static final String DB_HOST = System.getenv().getOrDefault("DB_HOST", "localhost");
    private static final String DB_PORT = System.getenv().getOrDefault("DB_PORT", "3306");
    private static final String DB_NAME = System.getenv().getOrDefault("DB_NAME", "test0310");
    private static final String USER = System.getenv().getOrDefault("DB_USER", "root");
    private static final String PASSWORD = System.getenv().getOrDefault("DB_PASSWORD", "lkjh890612");
    private static final String URL = String.format(
        "jdbc:mysql://%s:%s/%s?autoReconnect=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8",
        DB_HOST, DB_PORT, DB_NAME
    );

    static {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new RuntimeException("FATAL: 找不到 MySQL JDBC 驅動程式。請將 mysql-connector-j-....jar 加入 classpath。", e);
        }
    }

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USER, PASSWORD);
    }

    public static void main(String[] args) {
        try (Connection conn = DBConnect.getConnection()) {
            System.out.println("✅ 成功連接 MySQL！");
        } catch (Exception e) {
            System.err.println("❌ 連線測試失敗。請檢查 MySQL 伺服器是否運行，以及 DBConnect.java 中的 URL、使用者名稱和密碼是否正確。");
            e.printStackTrace();
        }
    }
}