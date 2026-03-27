import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://maximmilet9_db_user:GmhdqnjGXl57voPK@domain.4q4z15q.mongodb.net/?appName=Domain";
const DB_NAME = "DomainDB";
const COLLECTION_NAME = "selections";

// THE FIX: Define client outside the handler to reuse across 'warm' invocations
let cachedDb = null;

async function getDatabase() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}

export const handler = async (event) => {
  // CORS Headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const db = await getDatabase();
    const collection = db.collection(COLLECTION_NAME);

    // Warmup Ping Check
    if (event.queryStringParameters && event.queryStringParameters.warm === 'true') {
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ status: "Warmed up", connected: !!cachedDb }) 
      };
    }

    // GET Request: Fetch all saved choices
    if (event.httpMethod === "GET") {
      const selections = await collection.find({}).toArray();
      const selectionMap = selections.reduce((acc, curr) => {
        acc[curr.domain] = {
          forSale: curr.forSale || false
        };
        return acc;
      }, {});

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(selectionMap)
      };
    }

    // POST Request: Save selection
    if (event.httpMethod === "POST") {
      const { domain, forSale } = JSON.parse(event.body);
      
      if (!domain) return { statusCode: 400, headers, body: "Domain is required" };

      await collection.updateOne(
        { domain },
        { $set: { domain, forSale, updatedAt: new Date() } },
        { upsert: true }
      );

      return { 
        statusCode: 200, 
        headers,
        body: JSON.stringify({ message: "Sync successful" }) 
      };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };

  } catch (err) {
    console.error("Netlify Function Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
