package dao;

import java.sql.*;
import java.util.*;
import model.PaymentMethod;

/**
 * 付款方式資料存取物件（DAO）
 * 專責處理與付款方式相關的所有資料庫操作。
 */
public class PaymentMethodDAO {
    /** 資料庫連線物件 */
    private Connection conn;

    /**
     * 建構子，初始化 DAO 並注入資料庫連線
     * 
     * @param conn 資料庫連線
     */
    public PaymentMethodDAO(Connection conn) {
        this.conn = conn;
    }

    /**
     * 取得所有付款方式
     * 
     * @return 付款方式物件清單
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public List<PaymentMethod> getAll() throws SQLException {
        List<PaymentMethod> methods = new ArrayList<>();
        String sql = "SELECT idPaymentMethod, MethodName FROM payment_methods";
        try (PreparedStatement stmt = conn.prepareStatement(sql);
                ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                methods.add(new PaymentMethod(
                    rs.getInt("idPaymentMethod"),
                    rs.getString("MethodName")
                ));
            }
        }
        return methods;
    }
}
