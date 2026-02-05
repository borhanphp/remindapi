# Paddle Integration - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Get Paddle Credentials (2 min)

1. **Sign up for Paddle Sandbox**: https://sandbox-vendors.paddle.com
2. **Get API Key**:
   - Go to **Developer Tools** → **Authentication**
   - Click "Create API Key"
   - Copy the key (starts with `pdl_sdbx_`)

3. **Create Pro Plan**:
   - Go to **Catalog** → **Products**
   - Click "New Product"
   - Name: "Pro Plan"
   - Price: $9.00 USD
   - Billing: Monthly
   - Save and copy the **Price ID** (starts with `pri_`)

4. **Set up Webhook**:
   - Go to **Developer Tools** → **Notifications**
   - Click "Create destination"
   - URL: `https://your-ngrok-url.ngrok.io/api/paddle/webhook` (for local testing)
   - Select ALL events
   - Copy the **Webhook Secret** (starts with `pdl_ntfset_`)

### Step 2: Update .env (1 min)

Add these to your `.env` file:

```bash
PADDLE_API_KEY=pdl_sdbx_apikey_01xxxxx
PADDLE_WEBHOOK_SECRET=pdl_ntfset_01xxxxx
PADDLE_ENVIRONMENT=sandbox
PADDLE_PRO_PRICE_ID=pri_01xxxxx
```

### Step 3: Test It (2 min)

1. **Start your server**:
```bash
npm start
```

2. **Create a test account**:
```bash
POST http://localhost:5000/api/saas/register
Content-Type: application/json

{
  "organizationName": "Test Company",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Test123!"
}
```

3. **Check subscription status**:
```bash
GET http://localhost:5000/api/subscription/status
Authorization: Bearer YOUR_JWT_TOKEN
```

You should see:
```json
{
  "success": true,
  "data": {
    "plan": "free",
    "status": "trial",
    "usage": {
      "used": 0,
      "limit": 5,
      "remaining": 5
    },
    "trial": {
      "daysRemaining": 14
    }
  }
}
```

### Step 4: Test Upgrade (Optional)

1. **Initiate checkout**:
```bash
POST http://localhost:5000/api/paddle/checkout
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "plan": "pro"
}
```

2. **Visit the checkout URL** in the response
3. **Use Paddle test card**: See [Paddle Test Cards](https://developer.paddle.com/concepts/payment-methods/test-mode)
4. **Webhook will update your subscription automatically**

---

## 🧪 Testing Locally with ngrok

Since Paddle needs to send webhooks to your server:

1. **Install ngrok**: https://ngrok.com
2. **Start your app**: `npm start`
3. **In another terminal**: `ngrok http 5000`
4. **Copy the ngrok URL**: `https://abc123.ngrok.io`
5. **Update Paddle webhook** to: `https://abc123.ngrok.io/api/paddle/webhook`

Now Paddle can reach your local server!

---

## 📝 API Quick Reference

### Get Subscription Status
```bash
GET /api/subscription/status
Authorization: Bearer <token>
```

### Get Available Plans
```bash
GET /api/subscription/plans
```

### Create Checkout (Upgrade)
```bash
POST /api/paddle/checkout
Authorization: Bearer <token>
Content-Type: application/json

{ "plan": "pro" }
```

### Cancel Subscription
```bash
POST /api/paddle/cancel
Authorization: Bearer <token>
```

### Get Usage Statistics
```bash
GET /api/subscription/usage
Authorization: Bearer <token>
```

### Check Feature Access
```bash
GET /api/subscription/check-feature/automatedSchedule
Authorization: Bearer <token>
```

---

## 🛡️ Protect Your Routes

Add subscription checks to your invoice routes:

```javascript
const { 
  requireActiveSubscription, 
  checkInvoiceLimit 
} = require('../middleware/subscription');

// Require active subscription + check invoice limit
router.post('/invoices', 
  protect,                      // Requires authentication
  requireActiveSubscription,     // Requires active subscription
  checkInvoiceLimit,            // Checks free plan limit
  createInvoice
);

// Require Pro plan for this feature
const { requireProPlan } = require('../middleware/subscription');

router.post('/automated-schedules',
  protect,
  requireProPlan,               // Only Pro users
  createSchedule
);
```

---

## 📧 Email Notifications

Emails are sent automatically for:
- ✅ Trial start (welcome email)
- ✅ Trial expiring (7, 3, 1 days before)
- ✅ Trial expired
- ✅ Subscription activated (upgraded to Pro)
- ✅ Subscription cancelled
- ✅ Payment failed
- ✅ Usage limit warning (80% of free plan used)

All emails are beautiful HTML with clear CTAs!

---

## 🔄 Scheduled Tasks

The following run automatically:
- **Trial Expiration Check** - Daily (expires trials, sends emails)
- **Usage Monitoring** - Daily (sends warnings at 80% usage)
- **Invoice Reminders** - Hourly (your existing feature)

These start automatically when the server starts.

---

## 🎯 Next Steps

1. **Customize emails** in `services/subscriptionEmailService.js`
2. **Add usage tracking** to your dashboard
3. **Build pricing page** in your frontend
4. **Test the full flow** from signup to upgrade
5. **Monitor webhooks** in Paddle Dashboard

---

## 🐛 Common Issues

### "Webhook signature verification failed"
- Ensure `PADDLE_WEBHOOK_SECRET` is correct (no extra spaces)
- Check that raw body parsing is working in `server.js`
- Verify you're using the right environment (sandbox vs production)

### "Invoice limit not enforced"
- Ensure `checkInvoiceLimit` middleware is added to your invoice creation route
- Check that the Invoice model path is correct

### "Emails not sending"
- Verify SMTP credentials in `.env`
- Check `FROM_EMAIL` is valid
- Test with a simple email first

---

## 📚 Full Documentation

- [Complete Implementation Guide](./PADDLE_IMPLEMENTATION_COMPLETE.md)
- [Detailed Integration Guide](./PADDLE_INTEGRATION.md)

---

## ✅ You're All Set!

Your Paddle subscription system is ready. Start testing and customize as needed! 🎉
