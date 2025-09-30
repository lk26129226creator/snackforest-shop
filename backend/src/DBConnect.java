import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * 資料庫連線工具類別 DBConnect（放在預設 package，與專案其他檔案一致）
 */
public class DBConnect {
    // MySQL 連線資訊（加入 UTF-8 連線參數）
    private static final String URL = "jdbc:mysql://localhost:3306/test0310?autoReconnect=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8";
    private static final String USER = "root";
    private static final String PASSWORD = "lkjh890612"; // 請視情況修改

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