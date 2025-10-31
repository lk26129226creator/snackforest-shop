package dao;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import model.Customer;

/**
 * 顧客資料存取物件（DAO）
 * 專責處理與顧客相關的所有資料庫操作。
 */
public class CustomerDAO {
    /** 資料庫連線物件 */
    private Connection conn;

    /**
     * 建構子，初始化 DAO 並注入資料庫連線
     * 
     * @param conn 資料庫連線
     */
    public CustomerDAO(Connection conn) {
        this.conn = conn;
    }

    // --- 密碼雜湊工具方法 ---

    /**
     * 生成隨機鹽值
     * @return Base64 編碼的鹽值字串
     */
    private String generateSalt() {
        SecureRandom random = new SecureRandom();
        byte[] salt = new byte[16]; // 16 bytes = 128 bits
        random.nextBytes(salt);
        return Base64.getEncoder().encodeToString(salt);
    }

    /**
     * 雜湊密碼
     * @param password 原始密碼
     * @param salt 鹽值
     * @return Base64 編碼的雜湊密碼字串
     * @throws NoSuchAlgorithmException 如果找不到指定的雜湊演算法
     */
    private String hashPassword(String password, String salt) throws NoSuchAlgorithmException {
        String saltedPassword = password + salt;
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hashedBytes = md.digest(saltedPassword.getBytes());
        return Base64.getEncoder().encodeToString(hashedBytes);
    }

    /**
     * 依帳號與密碼查詢顧客
     * 
     * @param account  顧客帳號
     * @param password 顧客密碼
     * @return 查到則回傳 Customer 物件，否則回傳 null
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public Customer findByAccountAndPassword(String account, String password) throws SQLException, NoSuchAlgorithmException {
        String sql = "SELECT idCustomers, CustomerName, Account, PasswordHash, Salt FROM customers WHERE Account = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, account);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    Customer customer = mapRowToCustomer(rs);
                    // 驗證密碼
                    String storedHash = customer.getPasswordHash();
                    String storedSalt = customer.getSalt();
                    String providedPasswordHash = hashPassword(password, storedSalt);

                    if (storedHash.equals(providedPasswordHash)) {
                        return customer;
                    }
                }
            }
        }
        return null; // 查無資料或密碼不符
    }

    /**
     * 依帳號與電話（暫當密碼）查詢顧客。
     * 適用於尚未建置雜湊密碼欄位的情境，直接用 customers.Phone 做比對。
     */
    public Customer findByAccountAndPhone(String account, String phone) throws SQLException {
        // case-insensitive match on Account to be user-friendly
        String sql = "SELECT idCustomers, CustomerName, Account FROM customers WHERE LOWER(Account) = LOWER(?) AND Phone = ? LIMIT 1";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, account);
            stmt.setString(2, phone);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return new Customer(
                        rs.getInt("idCustomers"),
                        rs.getString("CustomerName"),
                        rs.getString("Account"),
                        null,
                        null
                    );
                }
            }
        }
        return null;
    }

    /**
     * 查詢所有顧客
     * 
     * @return 顧客物件清單
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public List<Customer> findAll() throws SQLException {
        List<Customer> customers = new ArrayList<>();
        String sql = "SELECT idCustomers, CustomerName, Account, PasswordHash, Salt FROM customers";
        try (PreparedStatement stmt = conn.prepareStatement(sql);
                ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                customers.add(mapRowToCustomer(rs));
            }
        }
        return customers;
    }

    /**
     * 新增顧客資料
     * 
     * @param customer 要儲存的顧客物件 (其 passwordHash 欄位應為原始密碼)
     * @return 成功則回傳 true，失敗則回傳 false
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public boolean save(Customer customer) throws SQLException, NoSuchAlgorithmException {
        String salt = generateSalt();
        String hashedPassword = hashPassword(customer.getPasswordHash(), salt);

        String sql = "INSERT INTO customers (idCustomers, CustomerName, Account, PasswordHash, Salt) VALUES (?, ?, ?, ?, ?)";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, customer.getId());
            stmt.setString(2, customer.getName());
            stmt.setString(3, customer.getAccount());
            stmt.setString(4, hashedPassword);
            stmt.setString(5, salt);
            return stmt.executeUpdate() > 0;
        }
    }

    /**
     * 依顧客編號刪除顧客
     * 
     * @param customerId 顧客編號
     * @return 成功則回傳 true，失敗則回傳 false
     * @throws SQLException 資料庫存取發生錯誤時拋出
     */
    public boolean delete(int customerId) throws SQLException {
        String sql = "DELETE FROM customers WHERE idCustomers = ?";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, customerId);
            return stmt.executeUpdate() > 0;
        }
    }

    /**
     * 將查詢結果 ResultSet 轉換為 Customer 物件（避免重複程式碼）
     * 
     * @param rs 查詢結果集
     * @return Customer 物件
     * @throws SQLException 資料庫欄位不存在時拋出
     */
    private Customer mapRowToCustomer(ResultSet rs) throws SQLException {
        return new Customer(
                rs.getInt("idCustomers"),
                rs.getString("CustomerName"),
                rs.getString("Account"),
                rs.getString("PasswordHash"),
                rs.getString("Salt"));
    }
}