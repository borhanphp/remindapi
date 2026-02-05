const sendEmail = require('../utils/sendEmail');

// @desc    Handle demo request submission
// @route   POST /api/marketing/demo-request
// @access  Public
exports.submitDemoRequest = async (req, res) => {
  try {
    const { fullName, email, company, companySize, industry, phone } = req.body;

    // Validate required fields
    if (!fullName || !email || !company) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email, and company name'
      });
    }

    // Email content for internal notification
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">New Demo Request</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px;">
          <h2 style="color: #1f2937; margin-bottom: 20px;">Contact Information</h2>
          
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
            <tr style="background: #f3f4f6;">
              <td style="padding: 15px; font-weight: bold; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Full Name</td>
              <td style="padding: 15px; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 15px; font-weight: bold; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Email</td>
              <td style="padding: 15px; color: #1f2937; border-bottom: 1px solid #e5e7eb;">
                <a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email}</a>
              </td>
            </tr>
            <tr style="background: #f3f4f6;">
              <td style="padding: 15px; font-weight: bold; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Company</td>
              <td style="padding: 15px; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${company}</td>
            </tr>
            <tr>
              <td style="padding: 15px; font-weight: bold; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Company Size</td>
              <td style="padding: 15px; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${companySize}</td>
            </tr>
            <tr style="background: #f3f4f6;">
              <td style="padding: 15px; font-weight: bold; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Industry</td>
              <td style="padding: 15px; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${industry}</td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding: 15px; font-weight: bold; color: #4b5563;">Phone</td>
              <td style="padding: 15px; color: #1f2937;">
                <a href="tel:${phone}" style="color: #667eea; text-decoration: none;">${phone}</a>
              </td>
            </tr>
            ` : ''}
          </table>

          <div style="margin-top: 30px; padding: 20px; background: white; border-left: 4px solid #10b981; border-radius: 8px;">
            <p style="margin: 0; color: #059669; font-weight: bold;">Action Required</p>
            <p style="margin: 10px 0 0 0; color: #4b5563;">Please reach out to this prospect within 24 hours to schedule their demo.</p>
          </div>
        </div>

        <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">This is an automated notification from Zeeventory Landing Page</p>
          <p style="margin: 5px 0 0 0;">Received at ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    const textContent = `
New Demo Request

Full Name: ${fullName}
Email: ${email}
Company: ${company}
Company Size: ${companySize}
Industry: ${industry}
${phone ? `Phone: ${phone}` : ''}

Received at: ${new Date().toLocaleString()}
    `;

    // Send email to both addresses
    const recipients = ['zeeventory@gmail.com', 'support@zeeventory.com'];
    
    try {
      await sendEmail({
        to: recipients.join(', '),
        subject: `🎯 New Demo Request from ${fullName} at ${company}`,
        text: textContent,
        html: htmlContent,
        replyTo: email
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError.message);
      // Continue anyway - we'll still try to send confirmation to user
    }

    // Send confirmation email to the user
    const confirmationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Thank You, ${fullName.split(' ')[0]}!</h1>
        </div>
        
        <div style="padding: 40px 30px; background: #f9fafb;">
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin-top: 0;">We've Received Your Demo Request</h2>
            
            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
              Our team is excited to show you how Zeeventory can transform your business operations. 
            </p>

            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 4px;">
              <p style="margin: 0; color: #1e40af; font-weight: bold;">📅 What's Next?</p>
              <p style="margin: 10px 0 0 0; color: #1e40af;">
                A member of our team will reach out to you within 24 hours to schedule your personalized demo.
              </p>
            </div>

            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
              In the meantime, feel free to explore our website or reach out to us at 
              <a href="mailto:support@zeeventory.com" style="color: #667eea; text-decoration: none;">support@zeeventory.com</a>
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="https://wa.me/8801855107614" style="display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                💬 Chat with Us on WhatsApp
              </a>
            </div>
          </div>

          <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
            <p>
              Have questions? Contact us at:<br/>
              📧 support@zeeventory.com<br/>
              📱 +880 1855-107614
            </p>
          </div>
        </div>

        <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© 2024 Zeeventory. All rights reserved.</p>
        </div>
      </div>
    `;

    const confirmationText = `
Hi ${fullName.split(' ')[0]},

Thank you for requesting a demo of Zeeventory!

Our team will reach out to you within 24 hours to schedule your personalized demo.

In the meantime, feel free to reach out to us:
- Email: support@zeeventory.com
- WhatsApp: +880 1855-107614

We're excited to show you how Zeeventory can transform your business!

Best regards,
The Zeeventory Team
    `;

    try {
      await sendEmail({
        to: email,
        subject: '✅ Your Zeeventory Demo Request - We\'ll Be In Touch Soon!',
        text: confirmationText,
        html: confirmationHtml
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError.message);
      // Continue anyway - the important thing is we logged the request
    }

    // Log the request data for manual follow-up if emails fail
    console.log('📋 DEMO REQUEST RECEIVED:');
    console.log(JSON.stringify({ fullName, email, company, companySize, industry, phone, timestamp: new Date().toISOString() }, null, 2));

    res.status(200).json({
      success: true,
      message: 'Demo request submitted successfully. Our team will contact you within 24 hours.'
    });

  } catch (error) {
    console.error('Error submitting demo request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit demo request. Please try again or contact us directly.',
      error: error.message
    });
  }
};

// @desc    Handle guide download request
// @route   POST /api/marketing/guide-request
// @access  Public
exports.submitGuideRequest = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address'
      });
    }

    // Email content for internal notification
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">New Guide Request</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px;">
          <p style="color: #4b5563; font-size: 16px;">
            Someone requested the SMB Software Comparison Guide:
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Email Address:</p>
            <p style="margin: 5px 0 0 0; color: #1f2937; font-size: 18px; font-weight: bold;">
              <a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email}</a>
            </p>
          </div>

          <p style="color: #6b7280; font-size: 12px; margin: 20px 0 0 0;">
            Received at: ${new Date().toLocaleString()}
          </p>
        </div>
      </div>
    `;

    // Send notification to internal team
    const recipients = ['zeeventory@gmail.com', 'support@zeeventory.com'];
    
    try {
      await sendEmail({
        to: recipients.join(', '),
        subject: `📥 New Guide Request from ${email}`,
        text: `New guide request from: ${email}\n\nReceived at: ${new Date().toLocaleString()}`,
        html: htmlContent,
        replyTo: email
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError.message);
    }

    // Send guide to the user
    const guideHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Your Free Guide is Here! 📚</h1>
        </div>
        
        <div style="padding: 40px 30px; background: #f9fafb;">
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin-top: 0;">The SMB Software Comparison Checklist</h2>
            
            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
              Thank you for your interest! Here are the key factors to consider when choosing business management software:
            </p>

            <div style="background: #f3f4f6; padding: 25px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">✅ Essential Features Checklist:</h3>
              <ul style="color: #4b5563; line-height: 2; margin: 0; padding-left: 20px;">
                <li>Inventory Management & Multi-warehouse Support</li>
                <li>CRM & Sales Pipeline Management</li>
                <li>Project & Task Management</li>
                <li>Accounting & Financial Reporting</li>
                <li>HR & Payroll Management</li>
                <li>Purchase & Procurement</li>
                <li>Automated Workflows & Integrations</li>
                <li>Mobile Access & Cloud-based</li>
                <li>Role-based Security & Permissions</li>
                <li>24/7 Support & Training Resources</li>
              </ul>
            </div>

            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px;">
              <p style="margin: 0; color: #065f46; font-weight: bold;">💡 Pro Tip</p>
              <p style="margin: 10px 0 0 0; color: #065f46;">
                Calculate your total cost of ownership including per-user fees, implementation costs, training, and ongoing maintenance. 
                With Zeeventory, you get everything for $69/month with unlimited users!
              </p>
            </div>

            <h3 style="color: #1f2937;">📊 Cost Comparison Guide:</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; color: #4b5563; border-bottom: 2px solid #e5e7eb;">Feature</th>
                <th style="padding: 12px; text-align: left; color: #4b5563; border-bottom: 2px solid #e5e7eb;">Typical Cost</th>
                <th style="padding: 12px; text-align: left; color: #10b981; border-bottom: 2px solid #e5e7eb;">Zeeventory</th>
              </tr>
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">Inventory Management</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">$89/mo</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #10b981; font-weight: bold;">Included</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">CRM</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">$75/mo</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #10b981; font-weight: bold;">Included</td>
              </tr>
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">Project Management</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">$49/mo</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #10b981; font-weight: bold;">Included</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">Accounting</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">$150/mo</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #10b981; font-weight: bold;">Included</td>
              </tr>
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">HR Management</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">$120/mo</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #10b981; font-weight: bold;">Included</td>
              </tr>
              <tr style="background: #f3f4f6; font-weight: bold;">
                <td style="padding: 12px; color: #1f2937;">Total</td>
                <td style="padding: 12px; color: #dc2626;">$483/mo</td>
                <td style="padding: 12px; color: #10b981; font-size: 18px;">$69/mo</td>
              </tr>
            </table>

            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:3001/saas/signup" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Start Your Free 14-Day Trial
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 20px;">
              Questions? We're here to help!<br/>
              <a href="mailto:support@zeeventory.com" style="color: #667eea;">support@zeeventory.com</a> | 
              <a href="https://wa.me/8801855107614" style="color: #667eea;">WhatsApp</a>
            </p>
          </div>
        </div>

        <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© 2024 Zeeventory. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        to: email,
        subject: '📚 Your Free SMB Software Comparison Guide - Compare 50+ Features',
        text: 'Thank you for downloading our SMB Software Comparison Guide! Please see the attached HTML email for the full guide.',
        html: guideHtml
      });
    } catch (emailError) {
      console.error('Failed to send guide email:', emailError.message);
    }

    // Log the request
    console.log('📋 GUIDE REQUEST RECEIVED:');
    console.log(JSON.stringify({ email, timestamp: new Date().toISOString() }, null, 2));

    res.status(200).json({
      success: true,
      message: 'Thank you! Our team will send you the guide shortly.'
    });

  } catch (error) {
    console.error('Error submitting guide request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send guide. Please try again or contact us directly.',
      error: error.message
    });
  }
};

