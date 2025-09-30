package model;

/**
 * 商品分類資料模型
 * 封裝分類的編號與名稱
 */
public class Category {
    /** 分類編號（對應資料表 idcategories 欄位） */
    private int idcategories;
    /** 分類名稱（對應資料表 categoryname 欄位） */
    private String categoryname;

    /**
     * 建構子，建立分類物件
     * 
     * @param id   分類編號
     * @param name 分類名稱
     */
    public Category(int id, String name) {
        this.idcategories = id;
        this.categoryname = name;
    }

    // --- Getter & Setter 方法 ---

    /** 取得分類編號 */
    public int getId() {
        return idcategories;
    }

    /** 取得分類名稱 */
    public String getName() {
        return categoryname;
    }

    /** 設定分類編號 */
    public void setId(int id) {
        this.idcategories = id;
    }

    /** 設定分類名稱 */
    public void setName(String name) {
        this.categoryname = name;
    }
}
