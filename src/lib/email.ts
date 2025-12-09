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

    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const retryUrl = `${apiBaseUrl}/webhook/lead/${context.requestId}/retry`;
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 25px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ Erro na Integração</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Auvo → Vtiger</p>
            </td>
        </tr>
        
        <!-- Content -->
        <tr>
            <td style="padding: 30px;">
                <!-- Request Info -->
                <table width="100%" style="background-color: #f8f9fa; border-radius: 6px; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 15px;">
                            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6c757d; text-transform: uppercase; letter-spacing: 1px;">Requisição</p>
                            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #343a40;">#${context.requestId}</p>
                            <p style="margin: 8px 0 0 0; font-size: 12px; color: #6c757d;">${timestamp}</p>
                        </td>
                    </tr>
                </table>

                <!-- Error Message -->
                <div style="margin-bottom: 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #6c757d; text-transform: uppercase; letter-spacing: 1px;">Mensagem de Erro</p>
                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px;">
                        <p style="margin: 0; color: #856404; font-size: 14px; word-break: break-word;">${error.message || 'Erro desconhecido'}</p>
                    </div>
                </div>

                <!-- Divider -->
                <hr style="border: none; border-top: 1px solid #e9ecef; margin: 25px 0;">

                <!-- Retry Section -->
                <div style="text-align: center; padding: 20px; background-color: #e8f5e9; border-radius: 6px;">
                    <p style="margin: 0 0 15px 0; font-size: 16px; color: #2e7d32; font-weight: bold;">🔄 Reprocessar Lead</p>
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #555;">Execute o comando abaixo no terminal:</p>
                    <div style="background-color: #263238; padding: 12px 15px; border-radius: 4px; display: inline-block;">
                        <code style="color: #4caf50; font-family: 'Courier New', monospace; font-size: 13px;">curl -X POST "${retryUrl}"</code>
                    </div>
                </div>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #343a40; padding: 20px; text-align: center;">
                <p style="margin: 0; color: #adb5bd; font-size: 12px;">Purifikar - Sistema de Integração Auvo-Vtiger</p>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: process.env.ERROR_EMAIL_TO,
            subject: `[Auvo-Vtiger Error] ${subject}`,
            text: `Erro na requisição #${context.requestId}\n\nErro: ${error.message}\n\nPara reprocessar: curl -X POST "${retryUrl}"`,
            html: htmlTemplate,
        });

        logger.info('Error email sent', { messageId: info.messageId });
    } catch (emailError) {
        logger.error('Failed to send error email', { error: emailError });
    }
}
