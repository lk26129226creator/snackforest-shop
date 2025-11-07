package model;

/**
 * 配送方式資料模型
 * 將後台設定的配送選項封裝成物件，供結帳流程選擇與顯示
 */
public class ShippingMethod {
    /** 配送方式主鍵（資料表 idshippingmethods） */
    private int id;
    /** 顯示名稱（例如宅配、超商取貨） */
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
