import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
    console.log('Testing Email Configuration...');
    console.log(`Host: ${process.env.SMTP_HOST}`);
    console.log(`Port: ${process.env.SMTP_PORT}`);
    console.log(`User: ${process.env.SMTP_USER}`);
    console.log(`To: ${process.env.ERROR_EMAIL_TO}`);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: process.env.ERROR_EMAIL_TO,
            subject: 'Test Email from Auvo-Vtiger Integration',
            text: 'If you receive this, your email configuration is correct.',
        });
        console.log('✅ Email sent successfully:', info.messageId);
    } catch (error) {
        console.error('❌ Failed to send email:', error);
    }
}

testEmail();
