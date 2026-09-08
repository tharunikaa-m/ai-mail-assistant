import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";
import { getGmailPushState } from "@/lib/gmail-push-state";

export async function POST() {
  try {
    // Check login
    const session: any = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get the stored Gmail push notification
    const state = getGmailPushState();

    if (!state.notification?.historyId) {
      return NextResponse.json({
        success: true,
        changed: false,
        message: "No new Gmail notification",
      });
    }

    // Gmail authentication
    const auth = new google.auth.OAuth2();

    auth.setCredentials({
      access_token: session.accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth,
    });

    // History ID from the previous sync/watch
    const startHistoryId =
      state.processedHistoryId ||
      state.watchHistoryId ||
      state.notification.historyId;

    console.log("Starting Gmail history sync:", {
      startHistoryId,
      notificationHistoryId: state.notification.historyId,
    });

    // Get Gmail changes
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId: startHistoryId,
      labelId: "INBOX",
      maxResults: 100,
    });

    const history = response.data.history || [];

    let changed = false;

    // Check whether anything changed
    for (const item of history) {
      if (item.messagesAdded && item.messagesAdded.length > 0) {
        changed = true;
      }

      if (item.messagesDeleted && item.messagesDeleted.length > 0) {
        changed = true;
      }

      if (item.labelsAdded && item.labelsAdded.length > 0) {
        changed = true;
      }

      if (item.labelsRemoved && item.labelsRemoved.length > 0) {
        changed = true;
      }
    }

    // Save latest history ID
    const latestHistoryId =
      response.data.historyId || state.notification.historyId;

    state.processedHistoryId = latestHistoryId;

    return NextResponse.json({
      success: true,
      changed,
      fullSyncRequired: false,
      historyId: latestHistoryId,
      historyCount: history.length,
    });
  } catch (error: any) {
    console.error("Gmail push sync error:", error);

    // Gmail can return 404 when the history ID
    // is too old or no longer available.
    if (error?.response?.status === 404) {
      const state = getGmailPushState();

      state.processedHistoryId = state.notification?.historyId || "";

      return NextResponse.json({
        success: true,
        changed: true,
        fullSyncRequired: true,
        historyId: state.notification?.historyId || "",
      });
    }

    return NextResponse.json(
      {
        error:
          error?.response?.data?.error?.message ||
          error?.message ||
          "Failed to sync Gmail changes",
      },
      { status: 500 },
    );
  }
}
