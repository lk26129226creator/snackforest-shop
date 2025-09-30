package dao;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * 資料庫連線工具類別 DBConnect
 */
public class DBConnect {
    // MySQL 連線資訊
    private static final String URL = "jdbc:mysql://localhost:3306/test0310?autoReconnect=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8";
    private static final String USER = "root";
    private static final String PASSWORD = "lkjh890612"; // <-- 請在這裡填寫您的真實 MySQL 密碼

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
}
