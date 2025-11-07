package dao;

import java.sql.*;
import java.util.*;
import model.ShippingMethod;

/**
 * 運送方式資料存取物件（DAO）
 * 專責處理與運送方式相關的所有資料庫操作。
 */
public class ShippingMethodDAO {
    /** 共用資料庫連線，保持 DAO 輕量並易於單元測試 */
    private Connection conn;

    /**
     * 建構子，初始化 DAO 並注入資料庫連線
     * 
     * @param conn 資料庫連線
     */
    public ShippingMethodDAO(Connection conn) {
        this.conn = conn;
    }

    /**
     * 取得所有運送方式
     * 
     * @return 運送方式物件清單
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public List<ShippingMethod> getAll() throws SQLException {
        List<ShippingMethod> methods = new ArrayList<>();
    // 明確列出欄位名稱，減少 SELECT * 對 schema 變動的敏感度
    String sql = "SELECT idshipping_methods, shipping_methodsName FROM shipping_methods";
        try (PreparedStatement stmt = conn.prepareStatement(sql);
                ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                methods.add(new ShippingMethod(
                    rs.getInt("idshipping_methods"),
                    rs.getString("shipping_methodsName")
                ));
            }
        }
        return methods;
    }
}
