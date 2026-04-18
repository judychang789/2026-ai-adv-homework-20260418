const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const el = document.getElementById('app');
    const orderId = el.dataset.orderId;
    const paymentResult = ref(el.dataset.paymentResult || null);

    const order = ref(null);
    const loading = ref(true);
    const paying = ref(false);
    const verifying = ref(false);

    const statusMap = {
      pending: { label: '待付款', cls: 'bg-apricot/20 text-apricot' },
      paid: { label: '已付款', cls: 'bg-sage/20 text-sage' },
      failed: { label: '付款失敗', cls: 'bg-red-100 text-red-600' },
    };

    const paymentMessages = {
      success: { text: '付款成功！感謝您的購買。', cls: 'bg-sage/10 text-sage border border-sage/20' },
      failed: { text: '付款失敗，請重試。', cls: 'bg-red-50 text-red-600 border border-red-100' },
      cancel: { text: '付款已取消。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
      returned: { text: '已從綠界返回，正在向綠界查詢最新付款結果。', cls: 'bg-blush text-rose-primary border border-rose-bg' },
      pending: { text: '付款尚未完成。若你剛完成付款，可點擊下方按鈕重新確認。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
    };

    async function loadOrder() {
      const res = await apiFetch('/api/orders/' + orderId);
      order.value = res.data;
    }

    function submitEcpayForm(action, fields) {
      var form = document.createElement('form');
      form.method = 'POST';
      form.action = action;
      form.style.display = 'none';

      Object.keys(fields).forEach(function (key) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = fields[key];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    }

    async function startEcpayCheckout() {
      if (!order.value || paying.value) return;
      paying.value = true;
      try {
        const res = await apiFetch('/api/orders/' + order.value.id + '/payment/ecpay/checkout', {
          method: 'POST'
        });
        submitEcpayForm(res.data.action, res.data.fields);
      } catch (err) {
        Notification.show(err?.data?.message || '建立綠界付款失敗', 'error');
      } finally {
        paying.value = false;
      }
    }

    async function verifyPayment(showToast) {
      if (!order.value || verifying.value || !order.value.merchant_trade_no) return;
      verifying.value = true;
      try {
        const res = await apiFetch('/api/orders/' + order.value.id + '/payment/ecpay/verify', {
          method: 'POST'
        });
        order.value = res.data.order;

        if (res.data.payment.is_paid) {
          paymentResult.value = 'success';
          if (showToast) Notification.show('付款狀態已更新為已付款', 'success');
        } else if (res.data.payment.is_failed) {
          paymentResult.value = 'failed';
          if (showToast) Notification.show('綠界回報此交易未成立', 'warning');
        } else {
          paymentResult.value = 'pending';
          if (showToast) Notification.show('綠界回報此交易尚未完成付款', 'info');
        }
      } catch (err) {
        Notification.show(err?.data?.message || '查詢付款狀態失敗', 'error');
      } finally {
        verifying.value = false;
      }
    }

    onMounted(async function () {
      try {
        await loadOrder();
        if (paymentResult.value === 'returned' && order.value && order.value.status !== 'paid' && order.value.merchant_trade_no) {
          await verifyPayment(false);
        }
      } catch (e) {
        Notification.show('載入訂單失敗', 'error');
      } finally {
        loading.value = false;
      }
    });

    return {
      order, loading, paying, verifying, paymentResult,
      statusMap, paymentMessages, startEcpayCheckout, verifyPayment
    };
  }
}).mount('#app');
