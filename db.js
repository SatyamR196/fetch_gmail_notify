import { MongoClient } from "mongodb";
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables
const uri = `mongodb+srv://satyamR196:${process.env.mongo_pass}@fetch-gmail.q6eos.mongodb.net/?retryWrites=true&w=majority&appName=Fetch-gmail`;
const client = new MongoClient(uri);

await client.connect();

export async function readD() {
    try {
        const database = client.db('Gmail_notify');
        const prevEmails = database.collection('prevEmails');
        let result = await prevEmails.find();
        result = await result.toArray();
        // console.log(result);
        let ids = result.map(email => email.id);
        return new Set(ids);
    }catch(err){
        console.log("Error in reading data from DB, line ~27",err);
    }
}

export async function insertD(emails) {
    try {
        const database = client.db('Gmail_notify');
        const prevEmails = database.collection('prevEmails');
        let result0 = await prevEmails.deleteMany({});
        let result = await prevEmails.insertMany(emails);
        // console.log(result0);
        // console.log(result);
    }catch(err){
        console.log("Error in reading data from DB, line ~89",err);
    }
}

export async function getTokenFromDB() {
    try{
        const database = client.db('Gmail_notify');
        const tokensCollection = database.collection('OAuth_token');
        return await tokensCollection.findOne({});
    }catch(err){
        console.log("Error in reading token from DB, line ~37",err);
    }
}

export async function saveTokenToDB(tokenData) {
    try{
        const database = client.db('Gmail_notify');
        const tokensCollection = database.collection('OAuth_token');
        await tokensCollection.updateOne({}, { $set: tokenData }, { upsert: true });
    }catch(err){
        console.log("Error in saving token to DB, line ~47",err);
    }
    
}