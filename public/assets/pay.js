/* The deposit payment (v1.10.0), shared by Book Now (site.js) and the private pay-later page (/book-now/pay/).

   Everything goes through the same PayPal business account and the same server routes: /api/paypal/order makes the
   order (custom_id = the booking reference, the amount set on the server) and /api/paypal/capture takes the payment,
   marks the booking paid and sends the "Deposit received" emails. The webhook is the backup, as before.

   Standard (PAYPAL_ADVANCED off): the PayPal buttons, which include PayPal's guest "Debit or Credit Card" button, so
   a patient can pay by card with no PayPal account.
   Advanced (PAYPAL_ADVANCED=on, once PayPal approves Advanced Checkout): card fields on this page in the APE look,
   with the bank's 3D Secure check when it asks for one, plus Apple Pay (Safari on Apple devices) and Google Pay
   (Chrome and Android) where the device supports them, and the PayPal button as another option.

   window.APE_PAYPAL_SDK and window.APE_GOOGLE_PAY_SDK point the scripts somewhere else for testing only. */
(function () {
  'use strict';
  if (window.APEPay) return;

  var TEXT = {
    choice: 'Pay by card, or with PayPal. You don’t need a PayPal account.',
    loading: 'Loading secure payment options',
    walletsOr: 'or pay by card',
    paypalOr: 'or pay with PayPal',
    cardName: 'Name on card', cardNumber: 'Card number', cardExpiry: 'Expiry (MM/YY)', cardCvv: 'Security code (CVV)',
    payCard: function (amt) { return 'Pay ' + amt + ' by card'; },
    paying: 'Processing your payment',
    cardIncomplete: 'Please check the card details: each box needs to be filled in correctly.',
    cardCheckRetry: 'Your bank’s security check was not finished, so nothing has been charged. Please try again.',
    cardCheckFailed: 'Your bank did not confirm this card, so nothing has been charged. Please try again, use another card, or choose another way to pay.',
    walletCancelled: 'No payment was taken. You can try again, or choose another way to pay.',
    released: 'This time was released because the payment wasn\u2019t finished within 30 minutes. Nothing has been charged. Please choose a time again.',
    secure: 'Payments are processed securely by PayPal. Your card details are not stored on this website.'
  };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + Number(n).toLocaleString('en-AU'); }
  function money2(n) { return (Math.round(Number(n) * 100) / 100).toFixed(2); }

  var sdk = {};
  function loadScript(url) {
    if (sdk[url]) return sdk[url];
    sdk[url] = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = url; sc.async = true;
      sc.onload = function () { resolve(); };
      sc.onerror = function () { delete sdk[url]; reject(new Error('script failed')); };
      document.head.appendChild(sc);
    });
    return sdk[url];
  }
  function paypalUrl(clientId, advanced) {
    var base = window.APE_PAYPAL_SDK || 'https://www.paypal.com/sdk/js';
    var q = '?client-id=' + encodeURIComponent(clientId) + '&currency=AUD&intent=capture&locale=en_AU';
    // standard: the PayPal button plus PayPal's guest card button. Advanced: our own card fields replace the guest
    // card button, so a patient never sees two card options.
    q += advanced
      ? '&components=buttons,card-fields,applepay,googlepay&disable-funding=card,paylater,venmo'
      : '&components=buttons&enable-funding=card&disable-funding=paylater,venmo';
    return base + q;
  }

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.httpOk = r.ok; return j; }); });
  }

  /* box: an element to fill. o: { clientId, token, amount, advanced, env, from ('book-now' | 'pay-page'),
     policyAgreedAt, policyVersion, onStart(source), onPaid(source), onState(state, message) } with state
     'ready' | 'cancelled' | 'error' | 'busy' | 'released' (v1.12.0: the held time ran out before payment). The deposit policy is agreed before this is shown (policy.js). */
  function mount(box, o) {
    var done = false;
    var amount = Number(o.amount) || 100;
    var released = false;
    /* v1.12.0: 'released' (the held time ran out before paying) wins over any later error message */
    function state(s, msg) { if (released) return; if (s === 'released') released = true; if (o.onState) o.onState(s, msg || ''); }
    function createOrder(source) {
      if (o.onStart) { try { o.onStart(source); } catch (e) { /* analytics only */ } }
      return post('/api/paypal/order', { token: o.token, source: source, policyAgreed: true, policyAgreedAt: o.policyAgreedAt || null, policyVersion: o.policyVersion || '', from: o.from || 'book-now' })
        .then(function (j) { if (!j.httpOk || !j.id) { var e = new Error(j.error || 'order'); e.code = j.error; if (e.code === 'released') state('released', TEXT.released); throw e; } return j.id; });
    }
    function capture(orderId, source) {
      return post('/api/paypal/capture', { token: o.token, orderId: orderId, source: source }).then(function (j) {
        if (j.httpOk && j.ok) { if (!done) { done = true; if (o.onPaid) o.onPaid(source); } return true; }
        var e = new Error(j.error || 'capture'); e.code = j.error; if (e.code === 'released') state('released', TEXT.released); throw e;
      });
    }
    function failMessage(err) {
      var c = err && err.code;
      if (c === 'released') return TEXT.released;
      if (c === 'card_check_retry') return TEXT.cardCheckRetry;
      if (c === 'card_check_failed') return TEXT.cardCheckFailed;
      return '';
    }

    box.innerHTML = '<div class="pay-options">' +
      '<p class="pay-choice"><strong>' + esc(TEXT.choice) + '</strong></p>' +
      '<p class="pay-loading" data-pay-loading>' + esc(TEXT.loading) + '</p>' +
      (o.advanced ? '<div class="pay-wallets" data-wallets hidden></div>' +
        '<div class="pay-card" data-card hidden><p class="pay-or" data-wallets-or hidden><span>' + esc(TEXT.walletsOr) + '</span></p>' +
          '<div class="card-field full" data-f="name"><span class="card-label">' + esc(TEXT.cardName) + '</span><div id="ape-card-name"></div></div>' +
          '<div class="card-field full" data-f="number"><span class="card-label">' + esc(TEXT.cardNumber) + '</span><div id="ape-card-number"></div></div>' +
          '<div class="card-row"><div class="card-field" data-f="expiry"><span class="card-label">' + esc(TEXT.cardExpiry) + '</span><div id="ape-card-expiry"></div></div>' +
          '<div class="card-field" data-f="cvv"><span class="card-label">' + esc(TEXT.cardCvv) + '</span><div id="ape-card-cvv"></div></div></div>' +
          '<button type="button" class="btn pay-card-btn" data-pay-card>' + esc(TEXT.payCard(money(amount))) + '</button>' +
          '<p class="pay-or"><span>' + esc(TEXT.paypalOr) + '</span></p></div>' : '') +
      '<div class="paypal-buttons" data-pp></div>' +
      '<p class="pay-secure">' + esc(TEXT.secure) + '</p></div>';
    var loadingNote = box.querySelector('[data-pay-loading]');
    function ready() { if (loadingNote) { loadingNote.remove(); loadingNote = null; } state('ready'); }

    return loadScript(paypalUrl(o.clientId, !!o.advanced)).then(function () {
      var pp = window.paypal;
      if (!pp) throw new Error('no sdk');
      var jobs = [];
      // the PayPal button (and, standard, the guest card button)
      jobs.push(pp.Buttons({
        style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay' },
        createOrder: function () { return createOrder('paypal'); },
        onApprove: function (data) { return capture(data.orderID, 'paypal').catch(function (e) { state('error', failMessage(e)); }); },
        onCancel: function () { state('cancelled'); },
        onError: function () { state('error'); }
      }).render(box.querySelector('[data-pp]')));
      if (o.advanced) {
        jobs.push(mountCard(pp).catch(function () { /* card fields not available: PayPal only */ }));
        jobs.push(mountApplePay(pp).catch(function () { /* not on this device */ }));
        jobs.push(mountGooglePay(pp).catch(function () { /* not on this device */ }));
      }
      return Promise.all(jobs).then(ready);
    }).catch(function () { state('error'); });

    // ---------------------------------------------------------------- card fields (3D Secure when required)
    function mountCard(pp) {
      if (!pp.CardFields) return Promise.reject(new Error('no card fields'));
      var wrap = box.querySelector('[data-card]');
      var cardSource = 'card';
      var cf = pp.CardFields({
        style: {
          input: { 'font-size': '16px', 'font-family': 'Arial, Helvetica, sans-serif', color: '#2A3C4E', padding: '12px' },
          '.invalid': { color: '#9B2C2C' }
        },
        createOrder: function () { return createOrder(cardSource); },
        onApprove: function (data) {
          return capture(data.orderID, cardSource).catch(function (e) { busy(false); state('error', failMessage(e)); });
        },
        onError: function () { busy(false); state('error', TEXT.cardCheckRetry); }
      });
      if (!cf.isEligible || !cf.isEligible()) return Promise.reject(new Error('not eligible'));
      var parts = [
        cf.NameField({ placeholder: '' }).render('#ape-card-name'),
        cf.NumberField({ placeholder: '' }).render('#ape-card-number'),
        cf.ExpiryField({ placeholder: 'MM/YY' }).render('#ape-card-expiry'),
        cf.CVVField({ placeholder: '' }).render('#ape-card-cvv')
      ];
      var btn = box.querySelector('[data-pay-card]');
      function busy(on) { btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); btn.textContent = on ? TEXT.paying + '…' : TEXT.payCard(money(amount)); }
      btn.addEventListener('click', function () {
        busy(true); state('busy');
        Promise.resolve(cf.getState ? cf.getState() : { isFormValid: true }).then(function (s) {
          if (s && s.isFormValid === false) { busy(false); state('error', TEXT.cardIncomplete); return; }
          return cf.submit().catch(function () { busy(false); state('error', TEXT.cardCheckRetry); });
        });
      });
      return Promise.all(parts).then(function () { wrap.hidden = false; });
    }

    // ---------------------------------------------------------------- Apple Pay (Safari on Apple devices)
    function showWallet(el) {
      var w = box.querySelector('[data-wallets]');
      w.appendChild(el); w.hidden = false;
      var or = box.querySelector('[data-wallets-or]');
      if (or) or.hidden = false;
    }
    function mountApplePay(pp) {
      var AP = window.ApplePaySession;
      if (!AP || !pp.Applepay || !AP.canMakePayments || !AP.canMakePayments()) return Promise.reject(new Error('no apple pay'));
      var applepay = pp.Applepay();
      return applepay.config().then(function (cfg) {
        if (!cfg || !cfg.isEligible) throw new Error('not eligible');
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'apple-pay-btn'; b.setAttribute('lang', 'en');
        b.setAttribute('aria-label', 'Pay with Apple Pay');
        b.innerHTML = '<span class="apple-pay-text" aria-hidden="true">Apple Pay</span>';
        b.addEventListener('click', function () {
          var session = new AP(4, {
            countryCode: cfg.countryCode || 'AU', currencyCode: 'AUD',
            merchantCapabilities: cfg.merchantCapabilities, supportedNetworks: cfg.supportedNetworks,
            requiredBillingContactFields: ['postalAddress'],
            total: { label: 'The Anxious Patient Experience deposit', amount: money2(amount), type: 'final' }
          });
          session.onvalidatemerchant = function (ev) {
            applepay.validateMerchant({ validationUrl: ev.validationURL })
              .then(function (r) { session.completeMerchantValidation(r.merchantSession); })
              .catch(function () { session.abort(); state('error'); });
          };
          session.onpaymentauthorized = function (ev) {
            var orderId;
            createOrder('apple_pay')
              .then(function (id) { orderId = id; return applepay.confirmOrder({ orderId: id, token: ev.payment.token, billingContact: ev.payment.billingContact }); })
              .then(function () { return capture(orderId, 'apple_pay'); })
              .then(function () { session.completePayment(AP.STATUS_SUCCESS); })
              .catch(function (e) { session.completePayment(AP.STATUS_FAILURE); state('error', failMessage(e)); });
          };
          session.oncancel = function () { state('cancelled', TEXT.walletCancelled); };
          session.begin();
        });
        showWallet(b);
      });
    }

    // ---------------------------------------------------------------- Google Pay (Chrome and Android)
    function mountGooglePay(pp) {
      if (!pp.Googlepay) return Promise.reject(new Error('no google pay'));
      return loadScript(window.APE_GOOGLE_PAY_SDK || 'https://pay.google.com/gp/p/js/pay.js').then(function () {
        var G = window.google && window.google.payments && window.google.payments.api;
        if (!G) throw new Error('no google pay');
        var googlepay = pp.Googlepay();
        return googlepay.config().then(function (cfg) {
          if (!cfg || cfg.isEligible === false) throw new Error('not eligible');
          var client = new G.PaymentsClient({
            environment: o.env === 'live' ? 'PRODUCTION' : 'TEST',
            paymentDataCallbacks: {
              onPaymentAuthorized: function (data) {
                var orderId;
                return createOrder('google_pay')
                  .then(function (id) { orderId = id; return googlepay.confirmOrder({ orderId: id, paymentMethodData: data.paymentMethodData }); })
                  .then(function (r) {
                    // the bank asks for a 3D Secure check
                    if (r && r.status === 'PAYER_ACTION_REQUIRED') return googlepay.initiatePayerAction({ orderId: orderId });
                  })
                  .then(function () { return capture(orderId, 'google_pay'); })
                  .then(function () { return { transactionState: 'SUCCESS' }; })
                  .catch(function (e) {
                    state('error', failMessage(e));
                    return { transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: 'The payment could not be completed. Nothing has been charged.', reason: 'PAYMENT_DATA_INVALID' } };
                  });
              }
            }
          });
          var methods = cfg.allowedPaymentMethods;
          return client.isReadyToPay({ apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: methods }).then(function (r) {
            if (!r || !r.result) throw new Error('not ready');
            var b = client.createButton({
              buttonColor: 'black', buttonType: 'pay', buttonSizeMode: 'fill', buttonLocale: 'en',
              onClick: function () {
                client.loadPaymentData({
                  apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: methods,
                  transactionInfo: { countryCode: cfg.countryCode || 'AU', currencyCode: 'AUD', totalPriceStatus: 'FINAL', totalPrice: money2(amount), totalPriceLabel: 'Deposit' },
                  merchantInfo: cfg.merchantInfo, callbackIntents: ['PAYMENT_AUTHORIZATION']
                }).catch(function (e) { if (e && e.statusCode === 'CANCELED') state('cancelled', TEXT.walletCancelled); });
              }
            });
            var holder = document.createElement('div');
            holder.className = 'google-pay-btn';
            holder.appendChild(b);
            showWallet(holder);
          });
        });
      });
    }
  }

  window.APEPay = { mount: mount, TEXT: TEXT };
})();
