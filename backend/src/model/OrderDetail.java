package model;

import java.math.BigDecimal;

/**
 * 訂單明細資料模型
 * 封裝單一訂單商品的資訊
 */
public class OrderDetail {
    /** 商品名稱 */
    private final String productName;
    /** 購買數量 */
    private final int quantity;
    /** 購買當下的價格 */
    private final BigDecimal priceAtTimeOfPurchase;

    /**
     * 建構子，建立訂單明細物件
     * 
     * @param productName           商品名稱
     * @param quantity              購買數量
     * @param priceAtTimeOfPurchase 購買當下的價格
     */
    public OrderDetail(String productName, int quantity, BigDecimal priceAtTimeOfPurchase) {
        this.productName = productName;
        this.quantity = quantity;
        this.priceAtTimeOfPurchase = priceAtTimeOfPurchase;
    }

    // --- Getter 方法 ---

    /** 取得商品名稱 */
    public String getProductName() {
        return productName;
    }

    /** 取得購買數量 */
    public int getQuantity() {
        return quantity;
    }

    /** 取得購買當下的價格 */
    public BigDecimal getPriceAtTimeOfPurchase() {
        return priceAtTimeOfPurchase;
    }
}
