package dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import model.Category;

/**
 * 商品分類資料存取物件（DAO）
 */
public class CategoryDAO {
    /** 共用資料庫連線，由外部注入以方便測試與資源管理 */
    private Connection conn;

    public CategoryDAO(Connection conn) {
        this.conn = conn;
    }

    /**
     * 查詢所有商品分類
     * @return 包含所有分類的 List
     * @throws SQLException 當資料庫連線或查詢失敗時拋出
     */
    public List<Category> findAll() throws SQLException {
        List<Category> category = new ArrayList<>();
        String sql = "SELECT * FROM category";
        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                int id = rs.getInt("idcategories");
                String name = rs.getString("categoryname");
                category.add(new Category(id, name));
            }
        }
        return category;
    }

    /**
     * 新增商品分類
     * @param category 要新增的 Category 物件
     * @return 新增成功後生成的 ID，如果失敗則為 -1
     * @throws SQLException 寫入新分類時若與資料庫連線或欄位限制衝突會拋出
     */
    public int save(Category category) throws SQLException {
        // 首先嘗試只插入名稱並透過資料庫的 AUTO_INCREMENT 取得新主鍵
        String sql = "INSERT INTO category (categoryname) VALUES (?)";
        try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            stmt.setString(1, category.getName());
            int rowsAffected = stmt.executeUpdate();
            if (rowsAffected > 0) {
                try (ResultSet rs = stmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        return rs.getInt(1);
                    }
                }
            }
        } catch (SQLException e) {
            // 若資料表沒有 AUTO_INCREMENT 或無法取得產生鍵，改為手動產生新的 id 再插入
            // 例如：Field 'idcategories' doesn't have a default value
            // 這裡不再次拋出例外，改由回退流程處理以保持兼容舊版資料庫
        }

        // 回退方案：自行取得下一個 id 再插入（相容沒有 AUTO_INCREMENT 的資料表）
        int nextId = getNextCategoryId();
        String sqlWithId = "INSERT INTO category (idcategories, categoryname) VALUES (?, ?)";
        try (PreparedStatement stmt = conn.prepareStatement(sqlWithId)) {
            stmt.setInt(1, nextId);
            stmt.setString(2, category.getName());
            int rowsAffected = stmt.executeUpdate();
            if (rowsAffected > 0) {
                return nextId;
            }
        }
        return -1; // 兩種策略皆失敗，回傳 -1 讓呼叫端得知未建立成功
    }

    /**
     * 取得下一個分類編號（MAX(idcategories)+1）。
     * 注意：這是簡易回退策略，非強一致性；適用於單人開發/小流量情境。
     */
    private int getNextCategoryId() throws SQLException {
        String q = "SELECT COALESCE(MAX(idcategories), 0) + 1 AS next_id FROM category";
        try (PreparedStatement ps = conn.prepareStatement(q); ResultSet rs = ps.executeQuery()) {
            if (rs.next()) return rs.getInt("next_id");
        }
        return 1;
    }

    /**
     * 更新商品分類
     * @param category 要更新的 Category 物件
     * @return 更新是否成功
     * @throws SQLException 更新過程中若資料庫拒絕請求則拋出
     */
    public boolean update(Category category) throws SQLException {
        String sql = "UPDATE category SET categoryname = ? WHERE idcategories = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, category.getName());
            stmt.setInt(2, category.getId());
            int rowsAffected = stmt.executeUpdate();
            return rowsAffected > 0;
        }
    }

    /**
     * 刪除商品分類
     * @param id 要刪除的分類 ID
     * @return 刪除是否成功
     * @throws SQLException 執行刪除時若發生資料庫錯誤則拋出
     */
    public boolean delete(int id) throws SQLException {
        String sql = "DELETE FROM category WHERE idcategories = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, id);
            int rowsAffected = stmt.executeUpdate();
            return rowsAffected > 0;
        }
    }
}
