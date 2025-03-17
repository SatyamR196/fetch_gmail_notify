import { MongoClient } from "mongodb";

// Replace the uri string with your connection string.
const uri = "mongodb+srv://satyamR196:4WmWUuBDc9HIO8JW@fetch-gmail.q6eos.mongodb.net/?retryWrites=true&w=majority&appName=Fetch-gmail";

const client = new MongoClient(uri);

async function run() {
  try {
    const database = client.db('Gmail_notify');
    const prevEmails = database.collection('prevEmails');

    // Query for a movie that has the title 'Back to the Future'
    const query = { title: 'Back to the Future' };
    let movie = await prevEmails.find();
    movie = await movie.toArray();
    // let result = await prevEmails.insertOne({
    //     name : "Shubho",
    //     roll_no : "22CH10065"
    // })

    console.log(movie);
    // console.log(result);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

run().catch(console.dir);