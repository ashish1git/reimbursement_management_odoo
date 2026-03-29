import nodemailer from 'nodemailer';

/**
 * Email Service using Nodemailer
 * Uses Ethereal for development (fake SMTP) or real SMTP in production
 */

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    // Production SMTP
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Dev fallback: Ethereal test account (messages appear on ethereal.email)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Using Ethereal test email. Preview URL will be logged for each email sent.');
  }

  return transporter;
}

const FROM = process.env.SMTP_FROM || '"ReimburseIQ" <noreply@reimburseiq.com>';

/**
 * Send an email
 */
async function sendMail({ to, subject, html, text }) {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: FROM,
      to,
      subject,
      text: text || '',
      html: html || '',
    });

    // In dev, log the Ethereal preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📧 Email Preview: ${previewUrl}`);
    }

    return { messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error('Email send failed:', err.message);
    throw err;
  }
}

/**
 * Send credentials to a newly created user
 */
async function sendCredentials({ name, email, password, companyName, role }) {
  return sendMail({
    to: email,
    subject: `Welcome to ${companyName} on ReimburseIQ!`,
    html: `
      <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="color:#4f46e5;font-size:24px;margin:0">ReimburseIQ</h1>
          <p style="color:#94a3b8;font-size:14px;margin:4px 0 0">Expense Management</p>
        </div>
        <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
          <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px">Welcome, ${name}!</h2>
          <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 20px">
            Your account has been created at <strong>${companyName}</strong>. Here are your login credentials:
          </p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-bottom:20px">
            <p style="margin:0 0 8px;font-size:13px;color:#475569"><strong>Email:</strong> ${email}</p>
            <p style="margin:0 0 8px;font-size:13px;color:#475569"><strong>Password:</strong> ${password}</p>
            <p style="margin:0;font-size:13px;color:#475569"><strong>Role:</strong> ${role}</p>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:0">
            Please change your password after your first login. If you did not expect this email, please ignore it.
          </p>
        </div>
        <p style="text-align:center;color:#cbd5e1;font-size:11px;margin:16px 0 0">
          © ${new Date().getFullYear()} ReimburseIQ. All rights reserved.
        </p>
      </div>
    `,
    text: `Welcome ${name}! Your account at ${companyName}: Email: ${email}, Password: ${password}, Role: ${role}`,
  });
}

/**
 * Send a temporary password for forgot-password flow
 */
async function sendPasswordReset({ name, email, tempPassword }) {
  return sendMail({
    to: email,
    subject: 'ReimburseIQ — Your temporary password',
    html: `
      <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="color:#4f46e5;font-size:24px;margin:0">ReimburseIQ</h1>
          <p style="color:#94a3b8;font-size:14px;margin:4px 0 0">Password Reset</p>
        </div>
        <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
          <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px">Hi ${name},</h2>
          <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 20px">
            A password reset was requested for your account. Your temporary password is:
          </p>
          <div style="background:#fef3c7;border-radius:8px;padding:16px;text-align:center;margin-bottom:20px;border:1px solid #fde68a">
            <p style="font-size:22px;font-weight:bold;color:#92400e;margin:0;letter-spacing:2px">${tempPassword}</p>
          </div>
          <p style="color:#ef4444;font-size:13px;font-weight:600;margin:0 0 8px">⚠️ Please change this password immediately after login.</p>
          <p style="color:#94a3b8;font-size:12px;margin:0">
            If you didn't request this, contact your admin. This password expires in 24 hours.
          </p>
        </div>
        <p style="text-align:center;color:#cbd5e1;font-size:11px;margin:16px 0 0">
          © ${new Date().getFullYear()} ReimburseIQ. All rights reserved.
        </p>
      </div>
    `,
    text: `Hi ${name}, your temporary password is: ${tempPassword}. Please change it after login.`,
  });
}

/**
 * Send approval/rejection notification to employee
 */
async function sendExpenseStatusUpdate({ name, email, expenseDescription, status, approverName, comment }) {
  const isApproved = status === 'APPROVED';
  return sendMail({
    to: email,
    subject: `Expense ${isApproved ? 'Approved' : 'Rejected'}: ${expenseDescription}`,
    html: `
      <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="color:#4f46e5;font-size:24px;margin:0">ReimburseIQ</h1>
        </div>
        <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
          <h2 style="color:#1e293b;font-size:18px;margin:0 0 16px">
            ${isApproved ? '✅' : '❌'} Expense ${status}
          </h2>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-bottom:16px">
            <p style="margin:0 0 8px;font-size:13px;color:#475569"><strong>Expense:</strong> ${expenseDescription}</p>
            <p style="margin:0 0 8px;font-size:13px;color:#475569"><strong>${isApproved ? 'Approved' : 'Rejected'} by:</strong> ${approverName}</p>
            ${comment ? `<p style="margin:0;font-size:13px;color:#475569"><strong>Comment:</strong> ${comment}</p>` : ''}
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:0">
            Log in to ReimburseIQ to view the full details.
          </p>
        </div>
      </div>
    `,
  });
}

export default {
  sendMail,
  sendCredentials,
  sendPasswordReset,
  sendExpenseStatusUpdate,
};
