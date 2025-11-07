import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * 資料庫連線工具類別 DBConnect（放在預設 package，與專案其他檔案一致）
 */
public class DBConnect {
    // MySQL 連線資訊（支援環境變數，保留預設值以支援本機開發）
    private static final String DB_HOST = firstNonBlank(System.getenv("MYSQLHOST"), System.getenv("DB_HOST"), "localhost");
    private static final String DB_PORT = firstNonBlank(System.getenv("MYSQLPORT"), System.getenv("DB_PORT"), "3306");
    private static final String DB_NAME = firstNonBlank(System.getenv("MYSQLDATABASE"), System.getenv("DB_NAME"), "test0310");
    private static final String USER = firstNonBlank(System.getenv("MYSQLUSER"), System.getenv("DB_USER"), "root");
    private static final String PASSWORD = firstNonBlank(System.getenv("MYSQLPASSWORD"), System.getenv("DB_PASSWORD"), "lkjh890612");
    private static final String URL = String.format(
        "jdbc:mysql://%s:%s/%s?autoReconnect=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8",
        DB_HOST, DB_PORT, DB_NAME
    );

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }

    static {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new RuntimeException("FATAL: 找不到 MySQL JDBC 驅動程式。請將 mysql-connector-j-....jar 加入 classpath。", e);
        }
    }

    /**
     * 建立一個新的資料庫連線。
     * 使用環境變數覆寫預設組態，以利在測試與正式環境切換。
     * @return 已開啟的 JDBC Connection 實例
     * @throws SQLException 當連線資訊錯誤或資料庫無法連線時拋出
     */
    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USER, PASSWORD);
    }

    /**
     * 允許開發者在命令列快速測試連線是否成功。
     * 若環境變數或資料庫設定錯誤，可直接在這裡看到具體例外訊息。
     */
    public static void main(String[] args) {
        try (Connection conn = DBConnect.getConnection()) {
            System.out.println("✅ 成功連接 MySQL！");
        } catch (Exception e) {
            System.err.println("❌ 連線測試失敗。請檢查 MySQL 伺服器是否運行，以及 DBConnect.java 中的 URL、使用者名稱和密碼是否正確。");
            e.printStackTrace();
        }
    }
}