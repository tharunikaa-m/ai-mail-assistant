import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";

const PROJECT_ID = "ai-mail-assistant-507509";
const TOPIC_NAME = "gmail-notifications-app";

export async function POST() {
  try {
    const session: any = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = new google.auth.OAuth2();

    auth.setCredentials({
      access_token: session.accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth,
    });

    const topicName = `projects/${PROJECT_ID}/topics/${TOPIC_NAME}`;

    const response = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName,
        labelIds: ["INBOX"],
        labelFilterAction: "include",
      },
    });

    return NextResponse.json({
      success: true,
      historyId: response.data.historyId || "",
      expiration: response.data.expiration || "",
      topicName,
    });
  } catch (error: any) {
    console.error("Gmail watch error:", error);

    return NextResponse.json(
      {
        error:
          error?.response?.data?.error?.message ||
          error?.message ||
          "Failed to create Gmail watch",
      },
      { status: 500 },
    );
  }
}
