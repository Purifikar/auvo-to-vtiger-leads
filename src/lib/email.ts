import nodemailer from 'nodemailer';
import { logger } from './logger';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendErrorEmail(subject: string, error: any, context: any) {
    if (!process.env.ERROR_EMAIL_TO) {
        logger.warn('Email configuration missing, skipping error email');
        return;
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: process.env.ERROR_EMAIL_TO,
            subject: `[Auvo-Vtiger Error] ${subject}`,
            text: `An error occurred in the Auvo-Vtiger integration.\n\nError: ${error.message}\n\nContext: ${JSON.stringify(context, null, 2)}`,
            html: `<h3>An error occurred in the Auvo-Vtiger integration.</h3><p><strong>Error:</strong> ${error.message}</p><pre>${JSON.stringify(context, null, 2)}</pre>`,
        });

        logger.info('Error email sent', { messageId: info.messageId });
    } catch (emailError) {
        logger.error('Failed to send error email', { error: emailError });
    }
}
