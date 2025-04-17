import fs from "fs";
import path from "path";
import readline from "readline";
import { google } from "googleapis";
import axios from "axios";
import open from "open";
import dotenv from "dotenv";
import he from "he";
import { MongoClient } from "mongodb";
import { getTokenFromDB, saveTokenToDB, insertD, readD } from "./db.js";

dotenv.config(); // Load environment variables

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

let prevEmails = await readD();
console.log("PREV MAILS",prevEmails);

// async function authenticate() {
//   const credentials = {
//     client_id: process.env.CLIENT_ID,
//     client_secret: process.env.CLIENT_SECRET,
//     redirect_uri: process.env.REDIRECT_URI,
//   };

//   const oAuth2Client = new google.auth.OAuth2(
//     credentials.client_id,
//     credentials.client_secret,
//     credentials.redirect_uri
//   );

//   // const TOKEN = {
//   //     access_token: process.env.ACCESS_TOKEN,
//   //     refresh_token: process.env.REFRESH_TOKEN,
//   //     scope: process.env.SCOPE,
//   //     token_type: process.env.TOKEN_TYPE,
//   //     refresh_token_expires_in: Number(process.env.REFRESH_TOKEN_EXPIRES_IN),
//   //     expiry_date: Number(process.env.EXPIRY_DATE)
//   // };

//   // if (TOKEN) {
//   //     oAuth2Client.setCredentials(TOKEN);
//   //     return oAuth2Client;
//   // }

//   // return getNewToken(oAuth2Client);

//   let token = await getTokenFromDB();

//   if (!token || !token.refresh_token) {
//     return getNewToken(oAuth2Client); // If no token, get a new one
//   }

//   oAuth2Client.setCredentials(token);

//   // Refresh access token if expired
//   // ✅ Use isTokenExpiring() to check if token is about to expire
//   if (oAuth2Client.isTokenExpiring()) {
//     try {
//       const { credentials } = await oAuth2Client.refreshAccessToken();
//       oAuth2Client.setCredentials(credentials);

//       await saveTokenToDB({
//         access_token: credentials.access_token,
//         refresh_token: token.refresh_token, // Keep the same refresh token
//         expiry_date: credentials.expiry_date,
//       });

//       console.log("✅ Access token refreshed and saved to MongoDB!");
//     } catch (error) {
//       console.error("❌ Failed to refresh token:", error);
//       return getNewToken(oAuth2Client);
//     }
//   }

//   return oAuth2Client;
// }

// // function getNewToken(oAuth2Client) {
// //   return new Promise((resolve, reject) => {
// //     const authUrl = oAuth2Client.generateAuthUrl({
// //       access_type: "offline",
// //       scope: SCOPES,
// //     });
// //     console.log("Authorize this app by visiting:", authUrl);
// //     open(authUrl);

// //     const rl = readline.createInterface({
// //       input: process.stdin,
// //       output: process.stdout,
// //     });
// //     rl.question("Enter the code from the page: ", (code) => {
// //       rl.close();
// //       oAuth2Client.getToken(code, (err, token) => {
// //         if (err) return reject("Error retrieving access token", err);
// //         console.log(
// //           "Token generated. Store this securely:",
// //           JSON.stringify(token)
// //         );
// //         resolve(oAuth2Client);
// //       });
// //     });
// //   });
// // }

async function getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // Ensures we get a refresh token
        prompt: 'consent',
        scope: SCOPES
    });

    console.log("🔗 Authorize this app by visiting:", authUrl);
    open(authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question("Enter the code from the page: ", async (code) => {
        rl.close();
        try {
            const { tokens } = await oAuth2Client.getToken(code);
            oAuth2Client.setCredentials(tokens);

            await saveTokenToDB({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expiry_date: tokens.expiry_date
            });

            console.log("✅ New token generated and saved to MongoDB!");
        } catch (error) {
            console.error("❌ Error retrieving access token:", error);
        }
    });
}

async function authenticate() {
  const credentials = {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI,
  };

  const oAuth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uri
  );

  let token = await getTokenFromDB();

  // If no token in DB, request new one
  if (!token || !token.refresh_token) {
    return await getNewToken(oAuth2Client);
  }

  oAuth2Client.setCredentials(token);

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Refresh token if about to expire (within next 5 mins)
  console.log("Token expiry date:", new Date(token.expiry_date).toLocaleString());
  console.log("now:", new Date(now).toLocaleString());
  if (token.expiry_date && now >= token.expiry_date - fiveMinutes) {
    try {
      // This will use refresh_token to update access_token
      await oAuth2Client.getAccessToken();

      const newCreds = oAuth2Client.credentials;

      // Save updated token to DB
      await saveTokenToDB({
        access_token: newCreds.access_token,
        refresh_token: token.refresh_token, // reuse same refresh token
        expiry_date: newCreds.expiry_date,
      });

      console.log("✅ Access token refreshed and saved to MongoDB!");
      console.log("🔐 Prev expiry date:", new Date(token.expiry_date).toLocaleString());
      console.log("🔐 Token will expire at:", new Date(newCreds.expiry_date).toLocaleString());
    } catch (error) {
      console.error("❌ Failed to refresh token:", error);
      return await getNewToken(oAuth2Client);
    }
  }

  return oAuth2Client;
}

async function fetchLatestEmails(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.list({ userId: "me", maxResults: 20 });
  const messages = res.data.messages || [];

  if (messages.length === 0) {
    console.log("No new emails.");
    return [];
  }

  const emailData = [];
  for (const msg of messages) {
    const email = await gmail.users.messages.get({ userId: "me", id: msg.id });
    const headers = email.data.payload.headers;
    const subject =
      headers.find((header) => header.name === "Subject")?.value ||
      "No Subject";
    const snippet = email.data.snippet;

    emailData.push({ id: msg.id, subject, snippet });
  }
  return emailData;
}

async function sendNotification(newEmails) {
  newEmails.reverse();
  for (const email of newEmails) {
    try {
      let date = new Date();
      let time = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "short",
        timeStyle: "medium", // Use 'long' to include seconds
      }).format(date);
      let message = `📩 **Subject:** ${email.subject}\n\n🔍 **Preview:** ${email.snippet} \n\n⌚ **Time:** ${time}`;
      message = he.decode(message);
      await axios.post(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, message, {
        headers: { "Content-Type": "text/plain" },
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
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
    if(latestEmails.length == 0) return;
    const newEmails = latestEmails.filter((email) => !prevEmails.has(email.id));

    if (newEmails.length > 0) {
      await sendNotification(newEmails);
      await insertD(latestEmails);
      prevEmails = new Set(latestEmails.map((email) => email.id));
    }
    
    if (newEmails.length == 0) {
      let date = new Date();
      let time = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "short",
        timeStyle: "medium", // Use 'long' to include seconds
      }).format(date);
      console.log(`No new emails till ${time}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

setInterval(main, 300000);
// setInterval(main, 15000);
// await main();

