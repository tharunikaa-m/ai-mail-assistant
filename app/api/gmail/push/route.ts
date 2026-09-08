import { NextResponse } from "next/server";

type GmailPushNotification = {
  emailAddress: string;
  historyId: string;
  receivedAt: number;
};

// Tell TypeScript about our server-side global value
declare global {
  var __gmailPushNotification: GmailPushNotification | undefined;
}

/*
  Gmail -> Pub/Sub -> this endpoint

  Pub/Sub sends:

  {
    "message": {
      "data": "base64-encoded-data"
    },
    "subscription": "projects/.../subscriptions/..."
  }

  Gmail notification data becomes:

  {
    "emailAddress": "user@gmail.com",
    "historyId": "123456"
  }
*/

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const encodedData = body?.message?.data;

    // -------------------------------------------------------
    // No Pub/Sub data
    // -------------------------------------------------------

    if (!encodedData) {
      console.warn("Pub/Sub request did not contain message.data");

      return NextResponse.json(
        {
          success: true,
          message: "No Gmail notification data received",
        },
        {
          status: 200,
        },
      );
    }

    // -------------------------------------------------------
    // Decode Pub/Sub message
    // -------------------------------------------------------

    let decodedData = "";

    try {
      decodedData = Buffer.from(encodedData, "base64").toString("utf-8");
    } catch (error) {
      console.error("Failed to decode Pub/Sub data:", error);

      return NextResponse.json(
        {
          error: "Invalid Pub/Sub message data",
        },
        {
          status: 400,
        },
      );
    }

    // -------------------------------------------------------
    // Parse Gmail notification
    // -------------------------------------------------------

    let notification: {
      emailAddress?: string;
      historyId?: string;
    } = {};

    try {
      notification = JSON.parse(decodedData);
    } catch (error) {
      console.error("Failed to parse Gmail notification:", decodedData);

      return NextResponse.json(
        {
          error: "Invalid Gmail notification JSON",
        },
        {
          status: 400,
        },
      );
    }

    console.log("Gmail push notification received:", notification);

    // -------------------------------------------------------
    // Store latest notification
    // -------------------------------------------------------

    globalThis.__gmailPushNotification = {
      emailAddress: notification.emailAddress || "",

      historyId: notification.historyId || "",

      receivedAt: Date.now(),
    };

    console.log(
      "Stored Gmail notification:",
      globalThis.__gmailPushNotification,
    );

    // -------------------------------------------------------
    // Acknowledge Pub/Sub
    // -------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("Gmail Pub/Sub webhook error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to process Gmail push notification",
      },
      {
        status: 500,
      },
    );
  }
}
