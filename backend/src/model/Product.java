package model;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.json.JSONArray;

/**
 * 商品資料模型
 * 統一封裝商品顯示與維護所需的全部欄位
 */
public class Product {
    /** 分類名稱（JOIN category 時補齊，供前端顯示） */
    private String categoryName;
    /** 商品編號（主鍵 idProducts） */
    private int idProducts;
    /** 分類編號（外鍵 CategoriesID） */
    private int categoriesID;
    /** 商品名稱 */
    private String productName;
    /** 售價（整數元） */
    private int price;
    /**
     * 圖片 URL 集合，可為 JSON 陣列字串或舊版逗號分隔格式
     * 透過 {@link #getImageUrlList()} 轉換為 List 以便使用
     */
    private String imageUrls;
    /** 商品介紹文字 */
    private String introduction;
    /** 產地資訊（可選） */
    private String origin;
    /** 生產日期 (yyyy-MM-dd) */
    private String productionDate;
    /** 有效期限 (yyyy-MM-dd) */
    private String expiryDate;

    public Product(int idProducts, int categoriesID, String productName, int price) {
        this.idProducts = idProducts;
        this.categoriesID = categoriesID;
        this.productName = productName;
        this.price = price;
        this.categoryName = null;
        this.imageUrls = null;
    }

    public Product(int idProducts, int categoriesID, String productName, int price, String categoryName) {
        this.idProducts = idProducts;
        this.categoriesID = categoriesID;
        this.productName = productName;
        this.price = price;
        this.categoryName = categoryName;
        this.imageUrls = null;
    }

    public Product(int idProducts, int categoriesID, String productName, int price, String categoryName, String imageUrls) {
        this.idProducts = idProducts;
        this.categoriesID = categoriesID;
        this.productName = productName;
        this.price = price;
        this.categoryName = categoryName;
        this.imageUrls = imageUrls;
        this.introduction = null;
    }

    public Product(int idProducts, int categoriesID, String productName, int price, String categoryName, String imageUrls, String introduction) {
        this.idProducts = idProducts;
        this.categoriesID = categoriesID;
        this.productName = productName;
        this.price = price;
        this.categoryName = categoryName;
        this.imageUrls = imageUrls;
        this.introduction = introduction;
        this.origin = null;
        this.productionDate = null;
        this.expiryDate = null;
    }

    public Product(int idProducts, int categoriesID, String productName, int price, String categoryName, String imageUrls, String introduction, String origin, String productionDate, String expiryDate) {
        this.idProducts = idProducts;
        this.categoriesID = categoriesID;
        this.productName = productName;
        this.price = price;
        this.categoryName = categoryName;
        this.imageUrls = imageUrls;
        this.introduction = introduction;
        this.origin = origin;
        this.productionDate = productionDate;
        this.expiryDate = expiryDate;
    }

    // --- Getter 與 Setter 方法 ---

    public int getIdProducts() {
        return idProducts;
    }

    public int getCategoriesID() {
        return categoriesID;
    }

    public String getProductName() {
        return productName;
    }

    public int getPrice() {
        return price;
    }

    public String getCategoryName() {
        return categoryName;
    }

    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }

    public void setIdProducts(int idProducts) {
        this.idProducts = idProducts;
    }

    public void setCategoriesID(int categoriesID) {
        this.categoriesID = categoriesID;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public void setPrice(int price) {
        this.price = price;
    }

    public String getImageUrls() {
        return imageUrls;
    }

    public void setImageUrls(String imageUrls) {
        this.imageUrls = imageUrls;
    }

    public String getIntroduction() {
        return introduction;
    }

    public void setIntroduction(String introduction) {
        this.introduction = introduction;
    }

    public String getOrigin() {
        return origin;
    }

    public void setOrigin(String origin) {
        this.origin = origin;
    }

    public String getProductionDate() {
        return productionDate;
    }

    public void setProductionDate(String productionDate) {
        this.productionDate = productionDate;
    }

    public String getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(String expiryDate) {
        this.expiryDate = expiryDate;
    }

    /**
     * 將 imageUrls 欄位轉換為 URL 字串清單。
     * 支援以下格式：
     * 1. 標準 JSON 陣列（例如 ["url1", "url2"]）
     * 2. 早期版本序列化錯誤的巢狀 JSON 字串（例如 "[\"url1\"]"）
     * 3. 舊版逗號分隔字串（例如 "url1,url2"）
     * 4. 空字串或 null（回傳空清單）
     * @return 乾淨的圖片 URL 清單
     */
    public List<String> getImageUrlList() {
        List<String> list = new ArrayList<>();
        if (imageUrls == null || imageUrls.isEmpty() || imageUrls.equals("[]")) {
            return list;
        }

        String current = imageUrls.trim();

        // 逐層拆解巢狀的 JSON 字串，確保取得最終乾淨陣列
        while (current.startsWith("[") && current.endsWith("]")) {
            try {
                JSONArray jsonArray = new JSONArray(current);
                if (jsonArray.length() == 0) {
                    return list; // 解析後為空陣列，代表沒有圖片可以回傳
                }
                // 如果第一個元素仍是一個 JSON 陣列字串，代表資料還沒清理乾淨
                String firstElement = jsonArray.optString(0, null);
                if (firstElement != null && firstElement.trim().startsWith("[")) {
                    current = firstElement; // 持續往內層解包，直到取得真正的 URL 陣列
                } else {
                    // 判定已經拿到最終的 URL 清單，逐一加入結果
                    for (int i = 0; i < jsonArray.length(); i++) {
                        list.add(jsonArray.getString(i));
                    }
                    return list;
                }
            } catch (Exception e) {
                // 若無法解析成 JSON，改用舊版逗號分隔格式處理
                break;
            }
        }

        // 如果進到這裡，代表不是合法 JSON 或已解析失敗，改以傳統逗號分隔處理
        list.addAll(Arrays.asList(current.split(",")));
        return list;
    }

    @Override
    public String toString() {
        return String.format("%s（價格：%d）", productName, price);
    }
}
