package model;

/**
 * 付款方式資料模型
 * 封裝付款方式的編號與名稱
 */
public class PaymentMethod {
    /** 付款方式編號 */
    private int id;
    /** 付款方式名稱 */
    private String methodName;

    /**
     * 建構子，建立付款方式物件
     * 
     * @param id         付款方式編號
     * @param methodName 付款方式名稱
     */
    public PaymentMethod(int id, String methodName) {
        this.id = id;
        this.methodName = methodName;
    }

    /** 取得付款方式編號 */
    public int getId() {
        return id;
    }

    /** 取得付款方式名稱 */
    public String getMethodName() {
        return methodName;
    }

    /** 設定付款方式編號 */
    public void setId(int id) {
        this.id = id;
    }

    /** 設定付款方式名稱 */
    public void setMethodName(String methodName) {
        this.methodName = methodName;
    }
}
