import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { google } from 'googleapis';
import axios from 'axios';
import open from 'open';
import dotenv from 'dotenv';
import he from 'he';

dotenv.config(); // Load environment variables

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
let prevEmails = new Set();

async function authenticate() {
    const credentials = {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI
    };
    const TOKEN = {
        access_token: process.env.ACCESS_TOKEN,
        refresh_token: process.env.REFRESH_TOKEN,
        scope: process.env.SCOPE,
        token_type: process.env.TOKEN_TYPE,
        refresh_token_expires_in: Number(process.env.REFRESH_TOKEN_EXPIRES_IN),
        expiry_date: Number(process.env.EXPIRY_DATE)
    };

    const oAuth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uri
    );

    if (TOKEN) {
        oAuth2Client.setCredentials(TOKEN);
        return oAuth2Client;
    }

    return getNewToken(oAuth2Client);
}

function getNewToken(oAuth2Client) {
    return new Promise((resolve, reject) => {
        const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
        console.log("Authorize this app by visiting:", authUrl);
        open(authUrl);

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question("Enter the code from the page: ", (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) return reject("Error retrieving access token", err);
                console.log("Token generated. Store this securely:", JSON.stringify(token));
                resolve(oAuth2Client);
            });
        });
    });
}

async function fetchLatestEmails(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });
    const messages = res.data.messages || [];

    if (messages.length === 0) {
        console.log("No new emails.");
        return [];
    }

    const emailData = [];
    for (const msg of messages) {
        const email = await gmail.users.messages.get({ userId: 'me', id: msg.id });
        const headers = email.data.payload.headers;
        const subject = headers.find(header => header.name === "Subject")?.value || "No Subject";
        const snippet = email.data.snippet;

        emailData.push({ id: msg.id, subject, snippet });
    }
    return emailData;
}

async function sendNotification(newEmails) {
    for (const email of newEmails) {
        try {
            let date = new Date();
            let time = new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'short',
                timeStyle: 'medium' // Use 'long' to include seconds
            }).format(date);
            let message = `📩 **Subject:** ${email.subject}\n\n🔍 **Preview:** ${email.snippet} \n\n⌚ **Time:** ${time}`;
            message = he.decode(message);
            await axios.post(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, message, {
                headers: { 'Content-Type': 'text/plain' }
            });
            console.log("📲 Notification sent successfully for:", email.subject);
        } catch (error) {
            console.error("❌ Error sending notification:", error);
        }
    }
}

async function main() {
    try {
        const auth = await authenticate();
        const latestEmails = await fetchLatestEmails(auth);

        const newEmails = latestEmails.filter(email => !prevEmails.has(email.id));
        if (newEmails.length > 0) {
            await sendNotification(newEmails);
        }
        if (newEmails.length == 0) {
            let date = new Date();
            let time = new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'short',
                timeStyle: 'medium' // Use 'long' to include seconds
            }).format(date);
            console.log(`No new emails till ${time}`);
        }

        prevEmails = new Set(latestEmails.map(email => email.id));
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

setInterval(main, 300000);
