package model;

/**
 * 配送方式資料模型
 * 封裝配送方式的編號與名稱
 */
public class ShippingMethod {
    /** 配送方式編號 */
    private int id;
    /** 配送方式名稱 */
    private String methodName;

    /**
     * 建構子，建立配送方式物件
     * 
     * @param id         配送方式編號
     * @param methodName 配送方式名稱
     */
    public ShippingMethod(int id, String methodName) {
        this.id = id;
        this.methodName = methodName;
    }

    /**
     * 取得配送方式編號
     */
    public int getId() {
        return id;
    }

    /**
     * 取得配送方式名稱
     */
    public String getMethodName() {
        return methodName;
    }

    /**
     * 設定配送方式編號
     */
    public void setId(int id) {
        this.id = id;
    }

    /**
     * 設定配送方式名稱
     */
    public void setMethodName(String methodName) {
        this.methodName = methodName;
    }
}
