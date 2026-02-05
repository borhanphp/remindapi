const sendEmail = require('../utils/sendEmail');

/**
 * Send welcome email with trial information
 */
exports.sendTrialStartEmail = async (user, organization) => {
    try {
        const trialDays = Math.ceil(
            (new Date(organization.subscription.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)
        );

        await sendEmail({
            to: user.email,
            subject: `Welcome to ${process.env.APP_NAME || 'ZeeRemind'} - Your Trial Has Started!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #4F46E5;">Welcome to ${process.env.APP_NAME || 'ZeeRemind'}! 🎉</h1>
                    
                    <p>Hi ${user.name},</p>
                    
                    <p>Thank you for signing up! Your organization "<strong>${organization.name}</strong>" has been created successfully.</p>
                    
                    <div style="background-color: #F3F4F6; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #4F46E5;">Your ${trialDays}-Day Free Trial</h3>
                        <p style="margin: 0;">You have full access to all Pro features during your trial period.</p>
                    </div>
                    
                    <h3>What you can do:</h3>
                    <ul>
                        <li>✅ Create unlimited invoices</li>
                        <li>✅ Set up automated reminders</li>
                        <li>✅ Access priority support</li>
                        <li>✅ Remove branding</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Get Started</a>
                    </div>
                    
                    <p style="color: #6B7280; font-size: 14px;">
                        Your trial will end on ${new Date(organization.subscription.trialEndsAt).toLocaleDateString()}. 
                        You can upgrade anytime to continue using all features.
                    </p>
                    
                    <p>Need help? Contact us at <a href="mailto:support@zeeremind.com">support@zeeremind.com</a></p>
                    
                    <p>Best regards,<br>The ${process.env.APP_NAME || 'ZeeRemind'} Team</p>
                </div>
            `
        });

        console.log(`Trial start email sent to ${user.email}`);
    } catch (error) {
        console.error('Failed to send trial start email:', error);
    }
};

/**
 * Send trial expiration warning (7 days before)
 */
exports.sendTrialExpiringEmail = async (user, organization, daysRemaining) => {
    try {
        await sendEmail({
            to: user.email,
            subject: `Your ${process.env.APP_NAME || 'ZeeRemind'} Trial Expires in ${daysRemaining} Days`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #F59E0B;">Your Trial is Ending Soon ⏰</h1>
                    
                    <p>Hi ${user.name},</p>
                    
                    <p>Your ${daysRemaining}-day trial for "<strong>${organization.name}</strong>" is ending soon.</p>
                    
                    <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Trial ends:</strong> ${new Date(organization.subscription.trialEndsAt).toLocaleDateString()}</p>
                        <p style="margin: 10px 0 0 0;"><strong>Days remaining:</strong> ${daysRemaining} days</p>
                    </div>
                    
                    <h3>Upgrade to Pro to keep:</h3>
                    <ul>
                        <li>✅ Unlimited invoices (only $9/month)</li>
                        <li>✅ Automated reminder schedules</li>
                        <li>✅ Priority support</li>
                        <li>✅ Custom branding</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/subscription/upgrade" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Upgrade to Pro - $9/month</a>
                    </div>
                    
                    <p style="color: #6B7280; font-size: 14px;">
                        After your trial ends, you'll be moved to the Free plan (5 invoices per month).
                    </p>
                    
                    <p>Best regards,<br>The ${process.env.APP_NAME || 'ZeeRemind'} Team</p>
                </div>
            `
        });

        console.log(`Trial expiring email sent to ${user.email}`);
    } catch (error) {
        console.error('Failed to send trial expiring email:', error);
    }
};

/**
 * Send trial expired email
 */
exports.sendTrialExpiredEmail = async (user, organization) => {
    try {
        await sendEmail({
            to: user.email,
            subject: `Your ${process.env.APP_NAME || 'ZeeRemind'} Trial Has Ended`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #DC2626;">Your Trial Has Ended</h1>
                    
                    <p>Hi ${user.name},</p>
                    
                    <p>Your trial period for "<strong>${organization.name}</strong>" has ended. You've been moved to the Free plan.</p>
                    
                    <div style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Free Plan Limitations:</h3>
                        <ul style="margin-bottom: 0;">
                            <li>5 invoices per month</li>
                            <li>Basic reporting only</li>
                            <li>Standard support</li>
                        </ul>
                    </div>
                    
                    <h3>Upgrade to Pro for just $9/month:</h3>
                    <ul>
                        <li>✅ <strong>Unlimited</strong> invoices</li>
                        <li>✅ Automated reminder schedules</li>
                        <li>✅ Priority support</li>
                        <li>✅ Remove "Powered by" branding</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/subscription/upgrade" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Upgrade to Pro</a>
                    </div>
                    
                    <p>Thank you for trying ${process.env.APP_NAME || 'ZeeRemind'}!</p>
                    
                    <p>Best regards,<br>The ${process.env.APP_NAME || 'ZeeRemind'} Team</p>
                </div>
            `
        });

        console.log(`Trial expired email sent to ${user.email}`);
    } catch (error) {
        console.error('Failed to send trial expired email:', error);
    }
};

/**
 * Send subscription activated email
 */
exports.sendSubscriptionActivatedEmail = async (user, organization) => {
    try {
        await sendEmail({
            to: user.email,
            subject: `Welcome to Pro! Your ${process.env.APP_NAME || 'ZeeRemind'} Subscription is Active`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #10B981;">Welcome to Pro! 🎉</h1>
                    
                    <p>Hi ${user.name},</p>
                    
                    <p>Thank you for upgrading! Your Pro subscription for "<strong>${organization.name}</strong>" is now active.</p>
                    
                    <div style="background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #10B981;">You now have access to:</h3>
                        <ul style="margin-bottom: 0;">
                            <li>✅ Unlimited invoices</li>
                            <li>✅ Automated reminder schedules</li>
                            <li>✅ Priority support</li>
                            <li>✅ Custom branding (no "Powered by")</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a>
                    </div>
                    
                    <p>You can manage your subscription anytime from your account settings.</p>
                    
                    <p>Need help? Our priority support team is here for you at <a href="mailto:support@zeeremind.com">support@zeeremind.com</a></p>
                    
                    <p>Best regards,<br>The ${process.env.APP_NAME || 'ZeeRemind'} Team</p>
                </div>
            `
        });

        console.log(`Subscription activated email sent to ${user.email}`);
    } catch (error) {
        console.error('Failed to send subscription activated email:', error);
    }
};

/**
 * Send subscription cancelled email
 */
exports.sendSubscriptionCancelledEmail = async (user, organization, endDate) => {
    try {
        await sendEmail({
            to: user.email,
            subject: `Your ${process.env.APP_NAME || 'ZeeRemind'} Subscription Will End`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #F59E0B;">Subscription Cancellation Confirmed</h1>
                    
                    <p>Hi ${user.name},</p>
                    
                    <p>We've received your cancellation request for "<strong>${organization.name}</strong>".</p>
                    
                    <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Your Pro access continues until:</strong> ${endDate ? new Date(endDate).toLocaleDateString() : 'end of billing period'}</p>
                        <p style="margin: 10px 0 0 0;">After this date, you'll be moved to the Free plan.</p>
                    </div>
                    
                    <p>We're sorry to see you go! If you change your mind, you can reactivate your subscription anytime before it ends.</p>
                    
                    <h3>What you'll lose on the Free plan:</h3>
                    <ul>
                        <li>❌ Unlimited invoices (only 5/month on Free)</li>
                        <li>❌ Automated reminder schedules</li>
                        <li>❌ Priority support</li>
                        <li>❌ Custom branding</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/subscription/manage" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Reactivate Subscription</a>
                    </div>
                    
                    <p>We'd love to hear your feedback. Please let us know why you're leaving: <a href="mailto:support@zeeremind.com">support@zeeremind.com</a></p>
                    
                    <p>Best regards,<br>The ${process.env.APP_NAME || 'ZeeRemind'} Team</p>
                </div>
            `
        });

        console.log(`Subscription cancelled email sent to ${user.email}`);
    } catch (error) {
        console.error('Failed to send subscription cancelled email:', error);
    }
};

/**
 * Send payment failed email
 */
exports.sendPaymentFailedEmail = async (user, organization) => {
    try {
        await sendEmail({
            to: user.email,
            subject: `Payment Failed - Action Required for ${process.env.APP_NAME || 'ZeeRemind'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #DC2626;">Payment Failed ⚠️</h1>
                    
                    <p>Hi ${user.name},</p>
                    
                    <p>We were unable to process your recent payment for "<strong>${organization.name}</strong>".</p>
                    
                    <div style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Action Required</h3>
                        <p style="margin-bottom: 0;">Please update your payment method to continue your Pro subscription.</p>
                    </div>
                    
                    <p>You have 7 days to update your payment information before your account is downgraded to the Free plan.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/subscription/billing" style="background-color: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment Method</a>
                    </div>
                    
                    <p style="color: #6B7280; font-size: 14px;">
                        Common reasons for payment failure:
                    </p>
                    <ul style="color: #6B7280; font-size: 14px;">
                        <li>Insufficient funds</li>
                        <li>Expired card</li>
                        <li>Billing address mismatch</li>
                    </ul>
                    
                    <p>Need help? Contact us at <a href="mailto:support@zeeremind.com">support@zeeremind.com</a></p>
                    
                    <p>Best regards,<br>The ${process.env.APP_NAME || 'ZeeRemind'} Team</p>
                </div>
            `
        });

        console.log(`Payment failed email sent to ${user.email}`);
    } catch (error) {
        console.error('Failed to send payment failed email:', error);
    }
};

/**
 * Send usage limit warning (approaching free plan limit)
 */
exports.sendUsageLimitWarningEmail = async (user, organization, usage) => {
    try {
        await sendEmail({
            to: user.email,
            subject: `You're Approaching Your Invoice Limit - ${process.env.APP_NAME || 'ZeeRemind'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #F59E0B;">Invoice Limit Warning ⚠️</h1>
                    
                    <p>Hi ${user.name},</p>
                    
                    <p>You've used <strong>${usage.used} out of ${usage.limit}</strong> invoices this month for "<strong>${organization.name}</strong>".</p>
                    
                    <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Remaining:</strong> ${usage.remaining} invoices</p>
                        <p style="margin: 10px 0 0 0;">Your limit resets on the 1st of next month.</p>
                    </div>
                    
                    <h3>Upgrade to Pro for Unlimited Invoices</h3>
                    <p>Just $9/month gets you:</p>
                    <ul>
                        <li>✅ <strong>Unlimited</strong> invoices</li>
                        <li>✅ Automated reminder schedules</li>
                        <li>✅ Priority support</li>
                        <li>✅ Remove branding</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/subscription/upgrade" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Upgrade to Pro</a>
                    </div>
                    
                    <p>Best regards,<br>The ${process.env.APP_NAME || 'ZeeRemind'} Team</p>
                </div>
            `
        });

        console.log(`Usage limit warning email sent to ${user.email}`);
    } catch (error) {
        console.error('Failed to send usage limit warning email:', error);
    }
};
