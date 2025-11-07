package model;

/**
 * 顧客資料模型
 * 封裝會員的識別資訊與加密後的登入憑證
 */
public class Customer {
    /** 顧客編號（對應資料表 idCustomers 欄位） */
    private int id;
    /** 顧客姓名 */
    private String name;
    /** 登入帳號（可為電子郵件或自訂字串） */
    private String account;
    /** 已雜湊的密碼字串，DAO 寫入資料庫時會進一步轉換 */
    private String passwordHash;
    /** 密碼雜湊使用的鹽值（與雜湊值成對保存） */
    private String salt;

    public Customer(int id, String name, String account, String passwordHash, String salt) {
        this.id = id;
        this.name = name;
        this.account = account;
        this.passwordHash = passwordHash;
        this.salt = salt;
    }

    // --- Getter & Setter 方法 ---

    public int getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getAccount() {
        return account;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getSalt() {
        return salt;
    }

    public void setId(int id) {
        this.id = id;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setAccount(String account) {
        this.account = account;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void setSalt(String salt) {
        this.salt = salt;
    }
}