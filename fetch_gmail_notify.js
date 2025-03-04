// require('dotenv').config();
// // const fs = require('fs');
// // const path = require('path');
// const readline = require('readline');
// const { google } = require('googleapis');
// const axios = require('axios');
// // const open = require('open');
// import open from 'open';

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { google } from 'googleapis';
import axios from 'axios';
import open from 'open';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables


const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

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
    console.log("🔍 Checking environment variables...");
    console.log("ACCESS_TOKEN:", process.env.ACCESS_TOKEN ? "✅ Loaded" : "❌ Missing");
    console.log("REFRESH_TOKEN:", process.env.REFRESH_TOKEN ? "✅ Loaded" : "❌ Missing");
    console.log("EXPIRY_DATE:", process.env.EXPIRY_DATE ? `✅ Loaded (${process.env.EXPIRY_DATE})` : "❌ Missing");

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

async function fetchLatestEmail(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.list({ userId: 'me', maxResults: 1 });
    const messages = res.data.messages;

    if (!messages || messages.length === 0) {
        console.log("No new emails.");
        return null;
    }

    const email = await gmail.users.messages.get({ userId: 'me', id: messages[0].id });
    const headers = email.data.payload.headers;
    const subject = headers.find(header => header.name === "Subject")?.value || "No Subject";
    const snippet = email.data.snippet;

    console.log("📧 New Email:", subject);
    return { subject, snippet };
}

let prev_msg = "" ;

async function sendNotification(subject, snippet) {
    try {
        const message = `📩 *New Email Received!*\n\n📌 **Subject:** ${subject}\n🔍 **Preview:** ${snippet}`;
        if(message == prev_msg) {
            console.log("📲 Notification already sent!");
            return;
        }
        await axios.post(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, message, {
            headers: { 'Content-Type': 'text/plain' }
        });

        console.log("📲 Notification sent successfully!");
        prev_msg = message;
    } catch (error) {
        console.error("❌ Error sending notification:", error);
    }
}

async function main() {
    try {
        const auth = await authenticate();
        const emailData = await fetchLatestEmail(auth);
        if (emailData) {
            await sendNotification(emailData.subject, emailData.snippet);
        }
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

setInterval(main, 20000);
