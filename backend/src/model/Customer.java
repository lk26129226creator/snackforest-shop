package model;

public class Customer {
    private int id;
    private String name;
    private String account;
    private String passwordHash;
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