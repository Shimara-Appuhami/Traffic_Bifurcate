import { NextResponse } from "next/server";
import {
  getAllCrawledItems,
  getCrawlHistory,
  getCrawledItemsBySession,
  deleteCrawledItem,
  deleteCrawlSession,
  getFeedDataBySession, // Added this import
} from "@/lib/mongodb";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    let data;
    if (sessionId) {
      // Fetch both crawled pages and feed data (contains XML) for this session
      const [pages, feedData] = await Promise.all([
        getCrawledItemsBySession(sessionId),
        getFeedDataBySession(sessionId),
      ]);

      const feed = feedData[0]; // Get the first feed entry

      console.log('[DEBUG crawled-data API] sessionId:', sessionId);
      console.log('[DEBUG crawled-data API] pages count:', pages.length);
      console.log('[DEBUG crawled-data API] feedData count:', feedData.length);
      console.log('[DEBUG crawled-data API] feed exists:', !!feed);
      if (feed) {
        console.log('[DEBUG crawled-data API] feed has xmlContent:', !!feed.xmlContent);
        console.log('[DEBUG crawled-data API] XML length:', feed.xmlContent?.length || 0);
      }

      return NextResponse.json({
        data: pages,
        feed: feed ? {
          xmlContent: feed.xmlContent,
          jsonContent: feed.jsonContent,
          siteDomain: feed.siteDomain,
          rootUrl: feed.rootUrl,
        } : null,
      });
    } else {
      data = await getCrawlHistory();
      return NextResponse.json({ data });
    }
  } catch (error) {
    console.error("Error fetching crawled data:", error);
    return NextResponse.json(
      { error: "Failed to fetch crawled data" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      const success = await deleteCrawlSession(sessionId);
      return NextResponse.json({ success });
    }

    if (url) {
      const success = await deleteCrawledItem(url);
      return NextResponse.json({ success });
    }

    return NextResponse.json(
      { error: "Provide url or sessionId parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error deleting crawled data:", error);
    return NextResponse.json(
      { error: "Failed to delete crawled data" },
      { status: 500 }
    );
  }
}
