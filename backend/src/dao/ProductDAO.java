package dao;

import java.sql.*;
import java.util.*;
import model.Product;
import org.json.JSONArray;

/**
 * 商品資料存取物件（DAO）
 * 專責處理與商品相關的所有資料庫操作。
 */
public class ProductDAO {
    /** 共用資料庫連線，由呼叫者負責開啟/關閉 */
    private Connection conn;

    public ProductDAO(Connection conn) {
        this.conn = conn;
    }

    /**
     * 查詢所有商品
     */
    public List<Product> findAll() throws SQLException {
        List<Product> products = new ArrayList<>();
    String sql = "SELECT p.idProducts, p.CategoriesID, p.ProductName, p.Price, c.categoryname, p.ImageUrl, p.Introduction " +
        ", p.Origin, p.ProductionDate, p.ExpiryDate " +
        "FROM products p " +
        "LEFT JOIN category c ON p.CategoriesID = c.idcategories";
        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
        products.add(new Product(
            rs.getInt("idProducts"),
            rs.getInt("CategoriesID"),
            rs.getString("ProductName"),
            rs.getInt("Price"),
            rs.getString("categoryname"),
            rs.getString("ImageUrl"), // JSON 字串
            rs.getString("Introduction"),
            rs.getString("Origin"),
            rs.getString("ProductionDate"),
            rs.getString("ExpiryDate")
        ));
            }
        }
        return products;
    }

    /**
     * 新增商品資料
     */
    public boolean save(Product product, int categoryId, List<String> imageUrls) throws SQLException {
        String sql = "INSERT INTO products (idProducts, ProductName, Price, CategoriesID, ImageUrl, Introduction, Origin, ProductionDate, ExpiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, product.getIdProducts());
            stmt.setString(2, product.getProductName());
            stmt.setInt(3, product.getPrice());
            stmt.setInt(4, categoryId);
            // 將圖片列表轉成 JSON 字串存入資料庫
            stmt.setString(5, new JSONArray(imageUrls).toString());
            stmt.setString(6, product.getIntroduction());
            stmt.setString(7, product.getOrigin());
            stmt.setString(8, product.getProductionDate());
            stmt.setString(9, product.getExpiryDate());
            int rowsAffected = stmt.executeUpdate();
            return rowsAffected > 0;
        }
    }

    /**
     * 取得下一個可用的商品編號
     */
    public int getNextProductId() throws SQLException {
        // 仍保留簡易 MAX+1 策略以兼容未啟用 AUTO_INCREMENT 的資料庫（僅適合單人操作環境）
        String sql = "SELECT IFNULL(MAX(idProducts), 0) + 1 AS nextId FROM products";
        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            if (rs.next()) return rs.getInt("nextId");
        }
        return 1;
    }

    /**
     * 更新商品資料
     */
    public boolean update(int id, String name, Integer price, Integer categoryId, List<String> imageUrls, String introduction, String origin, String productionDate, String expiryDate) throws SQLException {
        String sql = "UPDATE products SET ProductName = ?, Price = ?, CategoriesID = ?, ImageUrl = ?, Introduction = ?, Origin = ?, ProductionDate = ?, ExpiryDate = ? WHERE idProducts = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, name);
            stmt.setInt(2, price);
            stmt.setInt(3, categoryId);
            // 將 List<String> 轉成 JSON 存入資料庫
            stmt.setString(4, new JSONArray(imageUrls).toString());
            // 防止傳入 null 導致資料庫寫入空值，統一轉成空字串
            stmt.setString(5, introduction == null ? "" : introduction);
            stmt.setString(6, origin == null ? "" : origin);
            stmt.setString(7, productionDate == null ? "" : productionDate);
            stmt.setString(8, expiryDate == null ? "" : expiryDate);
            stmt.setInt(9, id);
            int rowsAffected = stmt.executeUpdate();
            return rowsAffected > 0;
        }
    }

    /**
     * 刪除商品資料
     */
    public boolean delete(int id) throws SQLException {
        String sql = "DELETE FROM products WHERE idProducts = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, id);
            int rowsAffected = stmt.executeUpdate();
            return rowsAffected > 0;
        }
    }

    /**
     * 依商品編號查詢特定商品
     */
    public Product findById(int id) throws SQLException {
        String sql = "SELECT p.idProducts, p.CategoriesID, p.ProductName, p.Price, c.categoryname, p.ImageUrl, p.Introduction, p.Origin, p.ProductionDate, p.ExpiryDate " +
                "FROM products p " +
                "LEFT JOIN category c ON p.CategoriesID = c.idcategories " +
                "WHERE p.idProducts = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return new Product(
                            rs.getInt("idProducts"),
                            rs.getInt("CategoriesID"),
                            rs.getString("ProductName"),
                            rs.getInt("Price"),
                            rs.getString("categoryname"),
                            rs.getString("ImageUrl"), // JSON 字串
                            rs.getString("Introduction"),
                            rs.getString("Origin"),
                            rs.getString("ProductionDate"),
                            rs.getString("ExpiryDate")
                    );
                }
            }
        }
        return null;
    }

    /**
     * 依分類 ID 查詢該分類下的所有商品
     */
    public List<Product> findByCategoryId(int categoryId) throws SQLException {
        List<Product> products = new ArrayList<>();
        String sql = "SELECT p.idProducts, p.CategoriesID, p.ProductName, p.Price, c.categoryname, p.ImageUrl, p.Introduction, p.Origin, p.ProductionDate, p.ExpiryDate " +
                "FROM products p " +
                "LEFT JOIN category c ON p.CategoriesID = c.idcategories " +
                "WHERE p.CategoriesID = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, categoryId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    products.add(new Product(
                            rs.getInt("idProducts"),
                            rs.getInt("CategoriesID"),
                            rs.getString("ProductName"),
                            rs.getInt("Price"),
                            rs.getString("categoryname"),
                            rs.getString("ImageUrl"),
                            rs.getString("Introduction"),
                            rs.getString("Origin"),
                            rs.getString("ProductionDate"),
                            rs.getString("ExpiryDate")
                    ));
                }
            }
        }
        return products;
    }
}
