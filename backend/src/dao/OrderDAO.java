package dao;

import java.math.BigDecimal;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import model.Order;
import model.OrderDetail;
import model.Product;

/**
 * 訂單與訂單明細的資料存取物件（DAO），統一封裝訂單建立、查詢與明細儲存邏輯。
 * 專責處理與訂單相關的所有資料庫操作。
 */
public class OrderDAO {
    /** 共用資料庫連線，採最小責任原則直接由外部管理生命週期 */
    private final Connection conn;

    /**
     * 建構子，初始化 DAO 並注入資料庫連線
     * 
     * @param conn 資料庫連線
     */
    public OrderDAO(Connection conn) {
        this.conn = conn;
    }

    /**
     * 儲存新訂單及其明細（購物車內容），並以交易方式確保資料一致性。
     *
     * @param order 訂單主檔物件
     * @param cart  購物車內容（商品及數量的對應）
     * @return 成功則回傳 true，失敗則回傳 false
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public int save(Order order, Map<Product, Integer> cart) throws SQLException {
        try {
            // 1. 開始交易
            conn.setAutoCommit(false);

            // 2. 新增訂單主檔，並取得自動產生的訂單編號
            // 使用 FK 欄位名稱 ShippingMethodId / PaymentMethodId，避免資料表在使用 Id 欄位時未被寫入
            String orderSql = "INSERT INTO orders (idCustomers, OrderDate, TotalAmount, ShippingMethodId, PaymentMethodId, RecipientName, RecipientAddress, RecipientPhone) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?)";
            int orderId;
            try (PreparedStatement orderStmt = conn.prepareStatement(orderSql, Statement.RETURN_GENERATED_KEYS)) {
                orderStmt.setInt(1, order.getCustomerId());
                orderStmt.setBigDecimal(2, order.getTotalAmount());
                // 運送/付款欄位可能為 FK（整數）或文字，視資料庫 schema 而定。
                // 嘗試把提供的值解析為整數並以 INT 寫入；若解析失敗則以 NULL 寫入（對應 FK 欄位）
                String ship = order.getShippingMethod();
                if (ship != null) {
                    try {
                        int shipId = Integer.parseInt(ship);
                        orderStmt.setInt(3, shipId);
                    } catch (NumberFormatException nfe) {
                        // If cannot parse to int, set NULL for INT FK column to avoid type errors
                        orderStmt.setNull(3, java.sql.Types.INTEGER);
                    }
                } else {
                    orderStmt.setNull(3, java.sql.Types.INTEGER);
                }

                String pay = order.getPaymentMethod();
                if (pay != null) {
                    try {
                        int payId = Integer.parseInt(pay);
                        orderStmt.setInt(4, payId);
                    } catch (NumberFormatException nfe) {
                        orderStmt.setNull(4, java.sql.Types.INTEGER);
                    }
                } else {
                    orderStmt.setNull(4, java.sql.Types.INTEGER);
                }

                orderStmt.setString(5, order.getRecipientName());
                orderStmt.setString(6, order.getRecipientAddress());
                orderStmt.setString(7, order.getRecipientPhone());
                orderStmt.executeUpdate();

                try (ResultSet generatedKeys = orderStmt.getGeneratedKeys()) {
                    if (generatedKeys.next()) {
                        orderId = generatedKeys.getInt(1);
                    } else {
                        throw new SQLException("Creating order failed, no ID obtained.");
                    }
                }
            }

            // 3. 新增購物車明細到訂單明細表
            String detailSql = "INSERT INTO order_details (idOrders, idProducts, Quantity, PriceAtTimeOfPurchase) VALUES (?, ?, ?, ?)";
            try (PreparedStatement detailStmt = conn.prepareStatement(detailSql)) {
                for (Map.Entry<Product, Integer> entry : cart.entrySet()) {
                    detailStmt.setInt(1, orderId);
                    detailStmt.setInt(2, entry.getKey().getIdProducts());
                    detailStmt.setInt(3, entry.getValue());
                    detailStmt.setBigDecimal(4, BigDecimal.valueOf(entry.getKey().getPrice()));
                    detailStmt.addBatch();
                }
                detailStmt.executeBatch();
            }

            // 4. 全部成功則提交交易
            conn.commit();
            return orderId;

        } catch (SQLException e) {
            // 發生錯誤則回復交易
            conn.rollback();
            throw e; // 例外重新拋出給呼叫端，由上層決定錯誤回應
        } finally {
            // 5. 恢復自動提交模式
            conn.setAutoCommit(true);
        }
    }

    /**
     * 執行查詢並將結果轉換為訂單物件清單
     * 
     * @param baseSql 查詢語法
     * @param params  查詢參數
     * @return 訂單物件清單
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    private List<Order> findOrders(String baseSql, Object... params) throws SQLException {
        List<Order> orders = new ArrayList<>();
        try (PreparedStatement stmt = conn.prepareStatement(baseSql)) {
            for (int i = 0; i < params.length; i++) {
                stmt.setObject(i + 1, params[i]);
            }
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
            orders.add(new Order(
                            rs.getInt("idOrders"),
                            rs.getTimestamp("OrderDate"),
                            rs.getBigDecimal("TotalAmount"),
                            rs.getString("CustomerName")));
                }
            }
        }
        return orders;
    }

    /**
     * 查詢所有訂單
     * 
     * @return 訂單物件清單
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public List<Order> findAll() throws SQLException {
        String sql = "SELECT o.idOrders, o.OrderDate, o.TotalAmount, c.CustomerName " +
                "FROM orders o JOIN customers c ON o.idCustomers = c.idCustomers " +
                "ORDER BY o.OrderDate DESC";
        return findOrders(sql);
    }

    /**
     * 依顧客編號查詢訂單
     * 
     * @param customerId 顧客編號
     * @return 訂單物件清單
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public List<Order> findByCustomerId(int customerId) throws SQLException {
        String sql = "SELECT o.idOrders, o.OrderDate, o.TotalAmount, c.CustomerName " +
                "FROM orders o JOIN customers c ON o.idCustomers = c.idCustomers " +
                "WHERE o.idCustomers = ? ORDER BY o.OrderDate DESC";
        return findOrders(sql, customerId);
    }

    /**
     * 依顧客姓名查詢訂單
     * 
     * @param customerName 顧客姓名
     * @return 訂單物件清單
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public List<Order> findByCustomerName(String customerName) throws SQLException {
        String sql = "SELECT o.idOrders, o.OrderDate, o.TotalAmount, c.CustomerName " +
                "FROM orders o JOIN customers c ON o.idCustomers = c.idCustomers " +
                "WHERE c.CustomerName LIKE ? ORDER BY o.OrderDate DESC";
        return findOrders(sql, "%" + customerName + "%");
    }

    /**
     * 依訂單編號查詢訂單明細
     * 
     * @param orderId 訂單編號
     * @return 訂單明細物件清單
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public List<OrderDetail> findDetailsByOrderId(int orderId) throws SQLException {
        List<OrderDetail> details = new ArrayList<>();
        String sql = "SELECT p.ProductName, od.Quantity, od.PriceAtTimeOfPurchase " +
                "FROM order_details od JOIN products p ON od.idProducts = p.idProducts " +
                "WHERE od.idOrders = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, orderId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    details.add(new OrderDetail(
                            rs.getString("ProductName"),
                            rs.getInt("Quantity"),
                            rs.getBigDecimal("PriceAtTimeOfPurchase")));
                }
            }
        }
        return details;
    }
}
