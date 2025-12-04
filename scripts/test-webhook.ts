import fs from 'fs';
import path from 'path';

async function testWebhook() {
    try {
        const payloadPath = path.join(__dirname, '../N8N Auvo docs/n8n structure.json');
        const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf-8'));

        console.log('Sending payload to http://localhost:3000/webhook/lead...');

        const response = await fetch('http://localhost:3000/webhook/lead', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Success:', data);
        } else {
            console.error('❌ Error:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response:', text);
        }
    } catch (error) {
        console.error('❌ Request failed:', error);
    }
}

testWebhook();
