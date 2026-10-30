// Invio email dalla Gmail del coach (GMAIL_USER + GMAIL_APP_PASSWORD, la "password per le app" di Google).
// Le email partono dall'app stessa: risultano inviate dalla casella e restano nella Posta inviata.
const nodemailer = require('nodemailer');

const configured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
let transport = null;
function tx() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') },
    });
  }
  return transport;
}

async function send({ to, subject, body, htmlBody, inReplyTo, references, headers }) {
  if (!configured()) throw new Error('Mancano GMAIL_USER e GMAIL_APP_PASSWORD su Render');
  const from = `${process.env.MAIL_FROM_NAME || 'Alessio · UN-MEMBER'} <${process.env.GMAIL_USER}>`;
  await tx().sendMail({ from, to, subject, text: body, html: htmlBody, ...(headers ? { headers } : {}), ...(inReplyTo ? { inReplyTo, references: references || inReplyTo } : {}) });
}

module.exports = { configured, send };
