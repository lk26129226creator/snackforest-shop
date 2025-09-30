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
    private Connection conn;

    public CategoryDAO(Connection conn) {
        this.conn = conn;
    }

    /**
     * 查詢所有商品分類
     * @return 包含所有分類的 List
     * @throws SQLException
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
     * @throws SQLException
     */
    public int save(Category category) throws SQLException {
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
        }
        return -1;
    }

    /**
     * 更新商品分類
     * @param category 要更新的 Category 物件
     * @return 更新是否成功
     * @throws SQLException
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
     * @throws SQLException
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
