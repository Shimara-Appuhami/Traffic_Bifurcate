import { MongoClient, Db, Collection, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB = process.env.MONGODB_DB || "traffic-bifurcate";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // Check for MongoDB URI at runtime (not build time)
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db(MONGODB_DB);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// Collection names
export const COLLECTIONS = {
  CRAWLED_DATA: "crawled_data",
  CRAWL_SESSIONS: "crawl_sessions",
  AI_MIRROR_DATA: "ai_mirror_data",
  FEED_DATA: "feed_data",
  USERS: "users",
} as const;

// Types for users
export interface User {
  _id?: ObjectId;
  email: string;
  name: string;
  password: string;
  createdAt: Date;
}

// Types for crawled data
export interface CrawledPage {
  _id?: ObjectId;
  url: string;
  ai_url: string;
  type: string;
  priority: number;
  title?: string;
  description?: string;
  markdown?: string;
  metadata?: {
    author?: string;
    published?: string;
    updated?: string;
    language?: string;
    contentType?: string;
    primaryTopics: string[];
    entities: string[];
  };
  createdAt: Date;
  sessionId: string;
}

export interface CrawlSession {
  _id?: ObjectId;
  sessionId?: string; // UUID for linking to crawled_data and feed_data
  siteDomain: string;
  rootUrl: string;
  pageCount: number;
  generatedAt: Date;
  completedAt: Date;
  status: "pending" | "completed" | "failed";
  error?: string;
}

export interface CrawlHistoryItem {
  sessionId: string;
  siteDomain: string;
  rootUrl: string;
  pageCount: number;
  generatedAt: Date;
  completedAt: Date;
  status: string;
}

// Types for AI mirror data
export interface AIMirrorData {
  _id?: ObjectId;
  source_url: string;
  mirror_url: string;
  page_type: string;
  intent: string;
  language: string;
  summary: string;
  key_topics: string[];
  entities: {
    people: string[];
    organizations: string[];
    technologies: string[];
    locations: string[];
  };
  structured_content: Array<{
    section: string;
    facts: string[];
  }>;
  markdown: string;
  metadata?: {
    author?: string;
    published?: string;
    updated?: string;
  };
  sessionId?: string;
  createdAt?: Date;
}

// Types for feed data
export interface FeedData {
  _id?: ObjectId;
  siteDomain: string;
  rootUrl: string;
  format: "xml" | "json" | "both";
  xmlContent?: string;
  jsonContent?: string;
  pageCount: number;
  sessionId?: string;
  createdAt?: Date;
}

// Helper functions for collections
export async function getCrawledDataCollection(): Promise<Collection<CrawledPage>> {
  const { db } = await connectToDatabase();
  return db.collection<CrawledPage>(COLLECTIONS.CRAWLED_DATA);
}

export async function getCrawlSessionsCollection(): Promise<Collection<CrawlSession>> {
  const { db } = await connectToDatabase();
  return db.collection<CrawlSession>(COLLECTIONS.CRAWL_SESSIONS);
}

export async function getAIMirrorCollection(): Promise<Collection<AIMirrorData>> {
  const { db } = await connectToDatabase();
  return db.collection<AIMirrorData>(COLLECTIONS.AI_MIRROR_DATA);
}

export async function getFeedCollection(): Promise<Collection<FeedData>> {
  const { db } = await connectToDatabase();
  return db.collection<FeedData>(COLLECTIONS.FEED_DATA);
}

// User operations
export async function getUsersCollection(): Promise<Collection<User>> {
  const { db } = await connectToDatabase();
  return db.collection<User>(COLLECTIONS.USERS);
}

export async function createUser(user: Omit<User, "_id" | "createdAt">): Promise<string> {
  const collection = await getUsersCollection();
  const document = {
    ...user,
    createdAt: new Date(),
  };
  const result = await collection.insertOne(document);
  return result.insertedId.toString();
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const collection = await getUsersCollection();
  return collection.findOne({ email: email.toLowerCase() });
}

// CRUD operations for crawled data
export async function saveCrawledPages(
  pages: Array<{
    url: string;
    ai_url: string;
    type: string;
    priority: number;
    title?: string;
    description?: string;
  }>,
  sessionId: string
): Promise<void> {
  const collection = await getCrawledDataCollection();
  const documents = pages.map((page) => ({
    ...page,
    createdAt: new Date(),
    sessionId,
  }));
  await collection.insertMany(documents);
}

export async function saveCrawlSession(
  session: Omit<CrawlSession, "_id">
): Promise<string> {
  const collection = await getCrawlSessionsCollection();
  const result = await collection.insertOne(session);
  return result.insertedId.toString();
}

export async function getAllCrawledItems(): Promise<CrawledPage[]> {
  const collection = await getCrawledDataCollection();
  return collection.find({}).sort({ createdAt: -1 }).toArray();
}

export async function getCrawledItemsBySession(
  sessionId: string
): Promise<CrawledPage[]> {
  const collection = await getCrawledDataCollection();
  return collection.find({ sessionId }).sort({ priority: -1 }).toArray();
}

export async function getCrawlHistory(): Promise<CrawlHistoryItem[]> {
  const collection = await getCrawlSessionsCollection();
  const sessions = await collection
    .find({})
    .sort({ generatedAt: -1 })
    .toArray();

  return sessions.map((session) => ({
    sessionId: session.sessionId || session._id?.toString() || "",
    siteDomain: session.siteDomain,
    rootUrl: session.rootUrl,
    pageCount: session.pageCount,
    generatedAt: session.generatedAt,
    completedAt: session.completedAt,
    status: session.status,
  }));
}

export async function deleteCrawledItem(url: string): Promise<boolean> {
  const collection = await getCrawledDataCollection();
  const result = await collection.deleteOne({ url });
  return result.deletedCount === 1;
}

export async function deleteCrawlSession(sessionId: string): Promise<boolean> {
  const sessionsCollection = await getCrawlSessionsCollection();
  const dataCollection = await getCrawledDataCollection();

  await dataCollection.deleteMany({ sessionId });
  const result = await sessionsCollection.deleteOne({
    _id: new ObjectId(sessionId),
  });

  return result.deletedCount === 1;
}

// AI Mirror data operations
export async function saveAIMirrorData(data: AIMirrorData): Promise<string> {
  const collection = await getAIMirrorCollection();
  const document = {
    ...data,
    createdAt: data.createdAt || new Date(),
  };
  const result = await collection.insertOne(document);
  return result.insertedId.toString();
}

export async function updateAIMirrorData(
  sourceUrl: string,
  data: Partial<AIMirrorData>
): Promise<boolean> {
  const collection = await getAIMirrorCollection();
  const result = await collection.updateOne(
    { source_url: sourceUrl },
    { $set: data }
  );
  return result.modifiedCount === 1;
}

export async function getAIMirrorByUrl(
  sourceUrl: string
): Promise<AIMirrorData | null> {
  const collection = await getAIMirrorCollection();
  return collection.findOne({ source_url: sourceUrl });
}

export async function getAllAIMirrorData(): Promise<AIMirrorData[]> {
  const collection = await getAIMirrorCollection();
  return collection.find({}).sort({ createdAt: -1 }).toArray();
}

export async function getAIMirrorBySession(
  sessionId: string
): Promise<AIMirrorData[]> {
  const collection = await getAIMirrorCollection();
  return collection.find({ sessionId }).sort({ createdAt: -1 }).toArray();
}

// Feed data operations
export async function saveFeedData(data: FeedData): Promise<string> {
  const collection = await getFeedCollection();
  const document = {
    ...data,
    createdAt: data.createdAt || new Date(),
  };
  const result = await collection.insertOne(document);
  return result.insertedId.toString();
}

export async function getFeedDataById(feedId: string): Promise<FeedData | null> {
  const collection = await getFeedCollection();
  return collection.findOne({ _id: new ObjectId(feedId) });
}

export async function getFeedDataBySession(
  sessionId: string
): Promise<FeedData[]> {
  const collection = await getFeedCollection();
  return collection.find({ sessionId }).sort({ createdAt: -1 }).toArray();
}

export async function getAllFeedData(): Promise<FeedData[]> {
  const collection = await getFeedCollection();
  return collection.find({}).sort({ createdAt: -1 }).toArray();
}

export async function deleteFeedData(feedId: string): Promise<boolean> {
  const collection = await getFeedCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(feedId) });
  return result.deletedCount === 1;
}
