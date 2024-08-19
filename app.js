const express = require('express');
const nodemailer = require('nodemailer');
const uuid = require('uuid');
const path = require('path');
const cheerio = require('cheerio');
const app = express();
const port = 3000;

// Configure this to your server's public URL
const BASE_URL = "https://mail-track.onrender.com";

// In-memory storage for emails and links (replace with a database in production)
const emails = new Map();
const links = new Map();
const campaigns = new Map();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Endpoint to track email opens
app.get('/track/:emailId', (req, res) => {
  const emailId = req.params.emailId;
  if (emails.has(emailId)) {
    const emailData = emails.get(emailId);
    emailData.openedAt = new Date();
    emailData.opened = true;
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
app.get('/link/:linkId', (req, res) => {
  const linkId = req.params.linkId;
  if (links.has(linkId)) {
    const linkData = links.get(linkId);
    linkData.clickedAt = new Date();
    linkData.clicked = true;
    links.set(linkId, linkData);
    console.log(`Link ${linkId} clicked at ${linkData.clickedAt}`);
    res.redirect(linkData.originalUrl);
  } else {
    res.status(404).send('Link not found');
  }
});

// Function to replace links with tracked versions
function replaceLinks(content, emailId) {
  const $ = cheerio.load(content);
  const emailLinks = [];

  $('a').each((index, element) => {
    const originalUrl = $(element).attr('href');
    const linkId = uuid.v4();
    const trackedUrl = `${BASE_URL}/link/${linkId}`;
    
    $(element).attr('href', trackedUrl);
    
    links.set(linkId, { id: linkId, originalUrl, emailId, clicked: false });
    emailLinks.push(linkId);
  });

  return { content: $.html(), links: emailLinks };
}

// Endpoint to send a tracked email campaign
app.post('/send-campaign', async (req, res) => {
  console.log('Received request to send email campaign');
  const { recipients, subject, content } = req.body;
  const campaignId = uuid.v4();

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

  const campaignResults = [];

  for (const to of recipients) {
    const emailId = uuid.v4();
    
    // Replace links and get the updated content
    const { content: trackedContent, links: emailLinks } = replaceLinks(content, emailId);

    // Generate HTML content with tracking pixel
    const htmlContent = `
      ${trackedContent}
      <img src="${BASE_URL}/track/${emailId}" style="display:none;" alt="">
    `;

    // Send mail with defined transport object
    try {
      console.log(`Attempting to send email to ${to}`);
      let info = await transporter.sendMail({
        from: '"burninghat" <burninghat20@gmail.com>',
        to: to,
        subject: subject,
        html: htmlContent
      });

      console.log(`Message sent to ${to}: ${info.messageId}`);
      const emailData = { id: emailId, to, subject, content: trackedContent, sentAt: new Date(), opened: false, links: emailLinks, campaignId };
      emails.set(emailId, emailData);
      campaignResults.push({ success: true, to, emailId, messageId: info.messageId });
    } catch (error) {
      console.error(`Error sending email to ${to}:`, error);
      campaignResults.push({ success: false, to, error: error.message });
    }
  }

  campaigns.set(campaignId, {
    id: campaignId,
    subject,
    content,
    sentAt: new Date(),
    recipients: recipients.length,
    results: campaignResults
  });

  res.json({ success: true, campaignId, results: campaignResults });
});

// Endpoint to get all campaigns
app.get('/campaigns', (req, res) => {
  res.json(Array.from(campaigns.values()));
});

// Endpoint to get campaign details
app.get('/campaign/:campaignId', (req, res) => {
  const campaignId = req.params.campaignId;
  const campaign = campaigns.get(campaignId);
  if (campaign) {
    const campaignEmails = Array.from(emails.values()).filter(email => email.campaignId === campaignId);
    res.json({ ...campaign, emails: campaignEmails });
  } else {
    res.status(404).json({ error: 'Campaign not found' });
  }
});

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at ${BASE_URL}`);
});