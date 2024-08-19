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

// Endpoint to check email status
app.get('/check/:emailId', (req, res) => {
  const emailId = req.params.emailId;
  const emailData = emails.get(emailId);
  if (emailData) {
    const linkData = emailData.links.map(linkId => links.get(linkId));
    res.json({...emailData, links: linkData});
  } else {
    res.json({ error: 'Email not found' });
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

// Endpoint to send a tracked email
app.post('/send-email', async (req, res) => {
  console.log('Received request to send email');
  const { to, subject, content } = req.body;
  const emailId = uuid.v4();

  // Replace links and get the updated content
  const { content: trackedContent, links: emailLinks } = replaceLinks(content, emailId);

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

  // Generate HTML content with tracking pixel
  const htmlContent = `
    ${trackedContent}
    <img src="${BASE_URL}/track/${emailId}" style="display:none;" alt="">
  `;

  // Send mail with defined transport object
  try {
    console.log('Attempting to send email');
    let info = await transporter.sendMail({
      from: '"BurningHat" <burninghat20@gmail.com>',
      to: to,
      subject: subject,
      html: htmlContent
    });

    console.log('Message sent: %s', info.messageId);
    const emailData = { id: emailId, to, subject, content: trackedContent, sentAt: new Date(), opened: false, links: emailLinks };
    emails.set(emailId, emailData);
    res.json({ success: true, emailId, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to get all sent emails
app.get('/emails', (req, res) => {
  const emailsWithLinkData = Array.from(emails.values()).map(email => ({
    ...email,
    links: email.links.map(linkId => links.get(linkId))
  }));
  res.json(emailsWithLinkData);
});

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at ${BASE_URL}`);
});