const { app, request, registerUser } = require('./setup');
const { generateCheckMacValue } = require('../src/services/ecpay');

describe('Orders API', () => {
  let userToken;
  let productId;
  let orderId;
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  beforeAll(async () => {
    // Register a user for order tests
    const { token } = await registerUser();
    userToken = token;

    // Get a product id
    const prodRes = await request(app).get('/api/products');
    productId = prodRes.body.data.products[0].id;

    // Add product to cart
    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId, quantity: 1 });
  });

  it('should create an order from cart', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        recipientName: '測試收件人',
        recipientEmail: 'recipient@example.com',
        recipientAddress: '台北市測試路 123 號',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
    expect(res.body).toHaveProperty('message');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('order_no');
    expect(res.body.data).toHaveProperty('total_amount');
    expect(res.body.data).toHaveProperty('status', 'pending');
    expect(res.body.data).toHaveProperty('items');
    expect(Array.isArray(res.body.data.items)).toBe(true);

    orderId = res.body.data.id;
  });

  it('should fail to create order with empty cart', async () => {
    // The cart was already cleared by the previous order
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        recipientName: '測試收件人',
        recipientEmail: 'recipient@example.com',
        recipientAddress: '台北市測試路 123 號',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('data', null);
    expect(res.body).toHaveProperty('error');
  });

  it('should fail to create order without auth', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        recipientName: '測試收件人',
        recipientEmail: 'recipient@example.com',
        recipientAddress: '台北市測試路 123 號',
      });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).not.toBeNull();
  });

  it('should get order list', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
    expect(res.body.data).toHaveProperty('orders');
    expect(Array.isArray(res.body.data.orders)).toBe(true);
    expect(res.body.data.orders.length).toBeGreaterThan(0);
  });

  it('should get order detail', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
    expect(res.body.data).toHaveProperty('id', orderId);
    expect(res.body.data).toHaveProperty('order_no');
    expect(res.body.data).toHaveProperty('items');
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('should create ecpay checkout form fields for a pending order', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/payment/ecpay/checkout`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toHaveProperty('action', 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5');
    expect(res.body.data).toHaveProperty('method', 'POST');
    expect(res.body.data).toHaveProperty('merchant_trade_no');
    expect(res.body.data.fields).toHaveProperty('MerchantTradeNo', res.body.data.merchant_trade_no);
    expect(res.body.data.fields).toHaveProperty('CheckMacValue');
    expect(res.body.data.fields).toHaveProperty('ClientBackURL');
  });

  it('should verify ecpay payment status and mark order as paid', async () => {
    const checkoutRes = await request(app)
      .post(`/api/orders/${orderId}/payment/ecpay/checkout`)
      .set('Authorization', `Bearer ${userToken}`);

    const merchantTradeNo = checkoutRes.body.data.merchant_trade_no;
    const orderDetailRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${userToken}`);

    const queryResponse = {
      MerchantID: '3002607',
      MerchantTradeNo: merchantTradeNo,
      StoreID: '',
      RtnCode: '1',
      RtnMsg: 'ok',
      TradeNo: '2404180000001',
      TradeAmt: String(orderDetailRes.body.data.total_amount),
      PaymentDate: '2026/04/18 20:00:00',
      PaymentType: 'Credit_CreditCard',
      TradeDate: '2026/04/18 19:59:59',
      TradeStatus: '1',
      SimulatePaid: '0',
      CustomField1: '',
      CustomField2: '',
      CustomField3: '',
      CustomField4: ''
    };

    queryResponse.CheckMacValue = generateCheckMacValue(
      queryResponse,
      'pwFHCqoQZGmho4w6',
      'EkRm7iFT261dpevs',
      'sha256'
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => new URLSearchParams(queryResponse).toString()
    });

    const verifyRes = await request(app)
      .post(`/api/orders/${orderId}/payment/ecpay/verify`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.error).toBeNull();
    expect(verifyRes.body.data.payment).toHaveProperty('is_paid', true);
    expect(verifyRes.body.data.order).toHaveProperty('status', 'paid');
    expect(verifyRes.body.data.order).toHaveProperty('ecpay_trade_no', '2404180000001');
  });

  it('should return 404 for non-existent order', async () => {
    const res = await request(app)
      .get('/api/orders/non-existent-order-id')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('data', null);
    expect(res.body).toHaveProperty('error');
  });
});
