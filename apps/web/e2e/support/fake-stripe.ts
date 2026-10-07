// Stripe.js の代わり。E2E では Stripe に接続せず、Payment Element の表示と確定の流れだけを確かめる。
// 実際のカード入力と本人認証（3D セキュア）は、Stripe のテスト環境で手動で確認する（docs/user-stories/register-payment-method.md）
export const FAKE_STRIPE_JS = `window.Stripe = function (key) {
  window.__stripeKey = key;
  return {
    _registerWrapper() {}, registerAppInfo() {}, createToken() {}, createPaymentMethod() {}, confirmCardPayment() {},
    elements() {
      return {
        create() {
          const handlers = {};
          const element = {
            mount(node) {
              const target = typeof node === "string" ? document.querySelector(node) : node;
              target.innerHTML = '<input aria-label="カード番号（テスト用）" />';
              setTimeout(() => (handlers.ready || []).forEach((cb) => cb({ elementType: "payment" })), 10);
            },
            on(name, cb) { (handlers[name] = handlers[name] || []).push(cb); return element; },
            off() { return element; }, update() {}, destroy() {}, unmount() {}, focus() {}, blur() {}, clear() {}, collapse() {},
          };
          return element;
        },
        getElement() { return null; }, update() {}, submit: async () => ({}), fetchUpdates: async () => ({}),
      };
    },
    confirmSetup: async (args) => {
      window.__confirm = { redirect: args.redirect };
      return window.__declineCard ? { error: { message: "カードが拒否されました" } } : { setupIntent: { status: "succeeded" } };
    },
  };
};`;
