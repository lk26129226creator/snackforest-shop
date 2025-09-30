package model;

import java.math.BigDecimal;
import java.sql.Timestamp;

/**
 * 訂單資料模型。
 * 封裝顧客訂單的所有資訊。
 */
public class Order {
    /** 訂單編號 */
    private int id;
    /** 顧客編號 */
    private final int customerId;
    /** 顧客姓名（僅顯示用，JOIN 查詢時填入） */
    private String customerName;
    /** 訂單日期 */
    private Timestamp orderDate;
    /** 訂單總金額 */
    private final BigDecimal totalAmount;
    /** 配送方式 */
    private final String shippingMethod;
    /** 付款方式 */
    private final String paymentMethod;
    /** 收件人姓名 */
    private final String recipientName;
    /** 收件人地址 */
    private final String recipientAddress;
    /** 收件人電話 */
    private final String recipientPhone;

    /**
     * 建立新訂單物件（存入資料庫前用）
     * @param customerId 顧客編號
     * @param totalAmount 訂單總金額
     * @param shippingMethod 配送方式
     * @param paymentMethod 付款方式
     * @param recipientName 收件人姓名
     * @param recipientAddress 收件人地址
     * @param recipientPhone 收件人電話
     */
    public Order(int customerId, BigDecimal totalAmount, String shippingMethod, String paymentMethod,
            String recipientName, String recipientAddress, String recipientPhone) {
        this.customerId = customerId;
        this.totalAmount = totalAmount;
        this.shippingMethod = shippingMethod;
        this.paymentMethod = paymentMethod;
        this.recipientName = recipientName;
        this.recipientAddress = recipientAddress;
        this.recipientPhone = recipientPhone;
    }

    /**
     * 由資料庫查詢結果建立訂單物件（通常用於訂單列表顯示）
     * @param id 訂單編號
     * @param orderDate 訂單日期
     * @param totalAmount 訂單總金額
     * @param customerName 顧客姓名
     */
    public Order(int id, Timestamp orderDate, BigDecimal totalAmount, String customerName) {
        this.id = id;
        this.orderDate = orderDate;
        this.totalAmount = totalAmount;
        this.customerName = customerName;
        // Initialize other fields to null as they are not fetched in list view
        this.customerId = 0;
        this.shippingMethod = null;
        this.paymentMethod = null;
        this.recipientName = null;
        this.recipientAddress = null;
        this.recipientPhone = null;
    }

    // --- Getter 方法 ---
    /**
     * 取得訂單編號
     */
    public int getId() {
        return id;
    }

    /**
     * 取得顧客編號
     */
    public int getCustomerId() {
        return customerId;
    }

    /**
     * 取得顧客姓名
     */
    public String getCustomerName() {
        return customerName;
    }

    /**
     * 取得訂單日期
     */
    public Timestamp getOrderDate() {
        return orderDate;
    }

    /**
     * 取得訂單總金額
     */
    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    /**
     * 取得配送方式
     */
    public String getShippingMethod() {
        return shippingMethod;
    }

    /**
     * 取得付款方式
     */
    public String getPaymentMethod() {
        return paymentMethod;
    }

    /**
     * 取得收件人姓名
     */
    public String getRecipientName() {
        return recipientName;
    }

    /**
     * 取得收件人地址
     */
    public String getRecipientAddress() {
        return recipientAddress;
    }

    /**
     * 取得收件人電話
     */
    public String getRecipientPhone() {
        return recipientPhone;
    }
}
