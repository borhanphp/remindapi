# Paddle Payment Integration - Setup Guide

## Overview

This project uses Paddle for processing subscription payments with a simple two-tier pricing model:

- **Free Plan**: $0/month with 5 invoices per month
- **Pro Plan**: $9/month with unlimited invoices

## Environment Setup

### Required Environment Variables

Add these to your `.env` file:

```bash
# Paddle Configuration
PADDLE_API_KEY=your_paddle_api_key_here
PADDLE_WEBHOOK_SECRET=your_paddle_webhook_secret_here
PADDLE_ENVIRONMENT=sandbox  # or 'production'
PADDLE_PRO_PRICE_ID=pri_01xxxxx  # Your Pro plan price ID from Paddle

# Frontend URL (for redirect after checkout)
FRONTEND_URL=https://yourdomain.com
```

### Getting Your Paddle Credentials

1. **API Key**: 
   - Log into Paddle Dashboard → Developer Tools → Authentication
   - Create a new API Key with appropriate permissions

2. **Webhook Secret**:
   - Go to Developer Tools → Notifications
   - Create a new webhook destination
   - Copy the webhook secret key

3. **Price ID**:
   - Go to Catalog → Prices
   - Find your Pro plan ($9/month)
   - Copy the Price ID (starts with `pri_`)

## Pricing Model

### Free Plan Features
- 5 invoices per month
- Email reminders
- Basic reporting
- No automated scheduling
- No priority support
- "Powered by" branding

### Pro Plan Features ($9/month)
- ✅ Unlimited invoices
- ✅ Email reminders
- ✅ Basic reporting
- ✅ Automated scheduling
- ✅ Priority support
- ✅ Remove "Powered by" branding

## API Endpoints

### Public Endpoints

#### Get Plans
```http
GET /api/paddle/plans
```

Returns available subscription plans with features.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "interval": "month",
      "features": { ... }
    },
    {
      "id": "pro",
      "name": "Pro",
      "price": 9,
      "interval": "month",
      "features": { ... }
    }
  ]
}
```

### Protected Endpoints (Require Authentication)

#### Create Checkout Session
```http
POST /api/paddle/checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "plan": "pro"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "checkoutId": "che_01xxxxx",
    "checkoutUrl": "https://buy.paddle.com/checkout/che_01xxxxx"
  }
}
```

#### Get Current Subscription
```http
GET /api/paddle/subscription
Authorization: Bearer <token>
```

#### Cancel Subscription
```http
POST /api/paddle/cancel
Authorization: Bearer <token>
```

Cancels subscription at the end of the current billing period.

#### Update Subscription
```http
POST /api/paddle/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "priceId": "pri_01xxxxx"
}
```

#### Get Transactions
```http
GET /api/paddle/transactions
Authorization: Bearer <token>
```

Returns payment history for the current user.

#### Get Billing Portal URL
```http
GET /api/paddle/portal-url
Authorization: Bearer <token>
```

## Webhook Configuration

### Setting Up Webhooks in Paddle

1. Go to Paddle Dashboard → Developer Tools → Notifications
2. Create a new webhook destination
3. Set URL to: `https://yourdomain.com/api/paddle/webhook`
4. Enable these event types:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `subscription.paused`
   - `subscription.resumed`
   - `transaction.completed`
   - `transaction.payment_failed`

### Webhook Security

Webhooks are automatically verified using signature verification in production mode. The signature is checked against `PADDLE_WEBHOOK_SECRET`.

### Supported Webhook Events

| Event | Description | Action Taken |
|-------|-------------|--------------|
| `subscription.created` | New subscription activated | Upgrade user to Pro, enable Pro features |
| `subscription.updated` | Subscription modified | Update user plan and features |
| `subscription.canceled` | Subscription cancelled | Downgrade to Free (immediate or at period end) |
| `subscription.paused` | Subscription paused | Set status to 'paused' |
| `subscription.resumed` | Subscription resumed | Restore active status |
| `transaction.completed` | Payment successful | Update status from 'past_due' to 'active' |
| `transaction.payment_failed` | Payment failed | Set status to 'past_due' |

## Frontend Integration Example

### 1. Display Pricing Page

Fetch plans from `/api/paddle/plans` and display them.

### 2. Initiate Checkout

```javascript
async function upgradeToPro() {
  try {
    const response = await fetch('/api/paddle/checkout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ plan: 'pro' })
    });

    const { data } = await response.json();
    
    // Redirect user to Paddle checkout
    window.location.href = data.checkoutUrl;
  } catch (error) {
    console.error('Checkout failed:', error);
  }
}
```

### 3. Handle Success

After successful payment, Paddle redirects to:
```
https://yourdomain.com/subscription/success
```

The webhook will automatically update the user's plan in the background.

## Database Schema

### User Model
```javascript
{
  plan: 'free' | 'pro',
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'paused' | 'trialing',
  paddleCustomerId: String,
  paddleSubscriptionId: String,
  billingCycle: 'monthly' | 'yearly'
}
```

### Organization Model
```javascript
{
  subscription: {
    plan: 'free' | 'pro',
    status: 'active' | 'trial' | 'expired' | 'cancelled' | 'past_due',
    trialEndsAt: Date,
    currentPeriodEnd: Date,
    paddleCustomerId: String,
    paddleSubscriptionId: String
  },
  features: {
    maxInvoices: Number,
    emailReminders: Boolean,
    basicReporting: Boolean,
    automatedSchedule: Boolean,
    prioritySupport: Boolean,
    removeBranding: Boolean
  }
}
```

### Subscription Model
```javascript
{
  organization: ObjectId,
  plan: 'free' | 'pro',
  status: 'active' | 'trial' | 'expired' | 'cancelled' | 'past_due' | 'paused',
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: Boolean,
  paddleCustomerId: String,
  paddleSubscriptionId: String,
  paddlePriceId: String,
  paddleTransactionId: String,
  billingCycle: {
    interval: 'month' | 'year',
    frequency: Number
  },
  nextBilledAt: Date,
  quantity: Number,
  currency: String,
  unitPrice: Number
}
```

## Testing

### Test in Sandbox Mode

1. Set `PADDLE_ENVIRONMENT=sandbox` in your `.env`
2. Use Paddle's test cards for checkout
3. Monitor webhook events in Paddle Dashboard → Developer Tools → Events

### Test Cards

Paddle provides test payment methods in sandbox mode. Check [Paddle's testing documentation](https://developer.paddle.com/concepts/payment-methods/test-mode) for details.

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook URL is publicly accessible
2. Verify webhook secret in `.env` matches Paddle Dashboard
3. Check webhook signature in production mode
4. Review Paddle Dashboard → Developer Tools → Events for failed deliveries

### Checkout Not Working

1. Verify `PADDLE_PRO_PRICE_ID` is correct
2. Ensure user is authenticated
3. Check API key has correct permissions
4. Review server logs for errors

### Subscription Status Not Updating

1. Verify webhooks are configured correctly
2. Check `custom_data` is being passed with `userId` and `organizationId`
3. Review webhook handler logs
4. Ensure MongoDB connection is active

## Security Best Practices

1. ✅ **Webhook Signature Verification**: Enabled in production
2. ✅ **Environment Variables**: Never commit secrets to git
3. ✅ **Raw Body Parsing**: Required for webhook signature verification
4. ✅ **Authentication**: All management endpoints require valid JWT
5. ✅ **Error Handling**: Errors logged but sensitive details hidden from clients

## Migration Notes

If you had previous subscription data with plans like 'basic', 'professional', or 'enterprise':

1. All existing subscriptions should be migrated to either 'free' or 'pro'
2. Run a data migration script to update existing records
3. Map old plans to new structure:
   - `basic`, `professional`, `enterprise` → `pro`
   - Any inactive subscriptions → `free`

## Support

For Paddle-specific issues:
- [Paddle Documentation](https://developer.paddle.com/)
- [Paddle Support](https://paddle.com/support)

For integration issues:
- Check server logs in `npm start` output
- Review webhook events in Paddle Dashboard
- Contact your development team
