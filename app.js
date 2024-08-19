const express = require('express');
const nodemailer = require('nodemailer');
const uuid = require('uuid');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Configure this to your server's public URL
const BASE_URL = "https://mail-track.onrender.com";

// In-memory storage (replace with a database in production)
const emails = new Map();
const templates = new Map();
const clicks = new Map();

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Email Templates
templates.set('welcome', {
  subject: 'Welcome to Our Service',
  body: `
    <h1>Welcome aboard!</h1>
    <p>We're excited to have you join us. Click the button below to get started:</p>
    <a href="{{CLICK_TRACKER_URL}}" style="background-color: #4CAF50; color: white; padding: 15px 32px; text-align: center; text-decoration: none; display: inline-block; font-size: 16px; margin: 4px 2px; cursor: pointer;">Get Started</a>
  `
});

templates.set('newsletter', {
  subject: 'Our Monthly Newsletter',
  body: `
    <h1>This Month's Highlights</h1>
    <ul>
      <li>New Feature: {{FEATURE_NAME}}</li>
      <li>Upcoming Event: <a href="{{CLICK_TRACKER_URL}}">Register Now</a></li>
      <li>Customer Spotlight: {{CUSTOMER_NAME}}</li>
    </ul>
  `
});

// Endpoint to track email opens
app.get('/track/:emailId', (req, res) => {
  const emailId = req.params.emailId;
  if (emails.has(emailId)) {
    const emailData = emails.get(emailId);
    emailData.openedAt = new Date();
    emailData.opened = true;
    emailData.openCount = (emailData.openCount || 0) + 1;
    emails.set(emailId, emailData);
    console.log(`Email ${emailId} opened at ${emailData.openedAt}`);
  }
  
  // Send a 1x1 transparent GIF
  const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private'
  });
  res.end(buffer);
});

// Endpoint to track link clicks
app.get('/click/:emailId/:linkId', (req, res) => {
  const { emailId, linkId } = req.params;
  if (emails.has(emailId)) {
    const clickData = clicks.get(emailId) || {};
    clickData[linkId] = (clickData[linkId] || 0) + 1;
    clicks.set(emailId, clickData);
    console.log(`Link ${linkId} in email ${emailId} clicked`);
  }
  
  // Redirect to the actual link (replace with your actual link)
  res.redirect('https://mail-track.onrender.com');
});

// Endpoint to send a tracked email
app.post('/send-email', async (req, res) => {
  console.log('Received request to send email');
  const { to, templateName, templateVars } = req.body;
  const emailId = uuid.v4();

  const template = templates.get(templateName);
  if (!template) {
    return res.status(400).json({ success: false, error: 'Template not found' });
  }

  // Replace template variables and add click tracking
  let htmlContent = template.body;
  const clickTrackerUrl = `${BASE_URL}/click/${emailId}/`;
  htmlContent = htmlContent.replace(/{{CLICK_TRACKER_URL}}/g, clickTrackerUrl);
  Object.entries(templateVars).forEach(([key, value]) => {
    htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });

  // Add open tracking pixel
  htmlContent += `<img src="${BASE_URL}/track/${emailId}" style="display:none;" alt="">`;

  // Create a nodemailer transporter (configure with your email service)
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'burninghat20@gmail.com',
      pass: 'afun rhda cgdf aqmg'
    }
  });

  // Send mail with defined transport object
  try {
    console.log('Attempting to send email');
    let info = await transporter.sendMail({
      from: '"Burninghat" <burninghat20@gmail.com>',
      to: to,
      subject: template.subject,
      html: htmlContent
    });

    console.log('Message sent: %s', info.messageId);
    const emailData = { id: emailId, to, templateName, sentAt: new Date(), opened: false, openCount: 0 };
    emails.set(emailId, emailData);
    res.json({ success: true, emailId, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to get all sent emails with analytics
app.get('/emails', (req, res) => {
  const emailsWithAnalytics = Array.from(emails.values()).map(email => {
    const clickData = clicks.get(email.id) || {};
    const totalClicks = Object.values(clickData).reduce((sum, count) => sum + count, 0);
    return {
      ...email,
      clickCount: totalClicks,
      clickDetails: clickData
    };
  });
  res.json(emailsWithAnalytics);
});

// Endpoint to get email templates
app.get('/templates', (req, res) => {
  res.json(Array.from(templates.entries()).map(([name, template]) => ({ name, subject: template.subject })));
});

app.listen(port, () => {
  console.log(`Server running at ${BASE_URL}`);
});