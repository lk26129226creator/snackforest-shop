package model;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.json.JSONArray;

/**
 * 商品資料模型
 * 封裝商品的基本資訊（如編號、名稱、價格、分類）
 */
public class Product {
    private String categoryName;
    private int idProducts;
    private int categoriesID;
    private String productName;
    private int price;
    private String imageUrls; // Can be JSON array string or legacy comma-separated
    private String introduction; // 商品介紹
    private String origin; // 產地
    private String productionDate; // 生產日期 (yyyy-MM-dd)
    private String expiryDate; // 有效期限 (yyyy-MM-dd)

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

    // --- Getters and Setters ---

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
     * Robustly parses the imageUrls string to get a list of URLs.
     * This method can handle:
     * 1. Valid JSON arrays (e.g., ["url1", "url2"]).
     * 2. Corrupted nested JSON array strings (e.g., "[\"url1\"]").
     * 3. Legacy comma-separated strings (e.g., "url1,url2").
     * 4. Empty or null strings.
     * @return A clean list of image URLs.
     */
    public List<String> getImageUrlList() {
        List<String> list = new ArrayList<>();
        if (imageUrls == null || imageUrls.isEmpty() || imageUrls.equals("[]")) {
            return list;
        }

        String current = imageUrls.trim();

        // Recursively unpack nested JSON strings
        while (current.startsWith("[") && current.endsWith("]")) {
            try {
                JSONArray jsonArray = new JSONArray(current);
                if (jsonArray.length() == 0) {
                    return list; // Empty array, we are done.
                }
                // Check if the first element is another JSON array string
                String firstElement = jsonArray.optString(0, null);
                if (firstElement != null && firstElement.trim().startsWith("[")) {
                    current = firstElement; // Unpack and loop again
                } else {
                    // Assume this is the final, clean array
                    for (int i = 0; i < jsonArray.length(); i++) {
                        list.add(jsonArray.getString(i));
                    }
                    return list;
                }
            } catch (Exception e) {
                // Failed to parse as JSON, break the loop and treat as legacy.
                break;
            }
        }

        // If we are here, it's either not JSON or was corrupted. Treat as legacy CSV.
        // This will also handle the case where the loop breaks.
        list.addAll(Arrays.asList(current.split(",")));
        return list;
    }

    @Override
    public String toString() {
        return String.format("%s（價格：%d）", productName, price);
    }
}
