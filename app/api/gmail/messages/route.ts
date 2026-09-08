import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    // =====================================================
    // 1. GET SESSION
    // =====================================================

    const session: any = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json(
        {
          error: "Not authenticated",
        },
        {
          status: 401,
        },
      );
    }

    // =====================================================
    // 2. GET SEARCH QUERY
    // =====================================================

    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q") || "";

    console.log("Gmail search query:", query);

    // =====================================================
    // 3. GOOGLE AUTH
    // =====================================================

    const auth = new google.auth.OAuth2();

    auth.setCredentials({
      access_token: session.accessToken,
    });

    // =====================================================
    // 4. GMAIL CLIENT
    // =====================================================

    const gmail = google.gmail({
      version: "v1",
      auth,
    });

    // =====================================================
    // 5. GET MESSAGE LIST
    // =====================================================

    const response = await gmail.users.messages.list({
      userId: "me",

      labelIds: ["INBOX"],

      ...(query
        ? {
            q: query,
          }
        : {}),

      maxResults: 20,
    });

    const messageList = response.data.messages || [];

    console.log("Messages found:", messageList.length);

    // =====================================================
    // 6. GET MESSAGE DETAILS
    // =====================================================

    const messages = await Promise.all(
      messageList.map(async (message) => {
        try {
          if (!message.id) {
            return null;
          }

          const detail = await gmail.users.messages.get({
            userId: "me",
            id: message.id,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"],
          });

          const headers = detail.data.payload?.headers || [];

          const getHeader = (name: string) => {
            return (
              headers.find(
                (header) => header.name?.toLowerCase() === name.toLowerCase(),
              )?.value || ""
            );
          };

          const from = getHeader("From");

          const to = getHeader("To");

          const subject = getHeader("Subject") || "(No subject)";

          const date = getHeader("Date");

          const internalDate = Number(detail.data.internalDate || 0);

          // =================================================
          // CHECK READ / UNREAD
          // =================================================

          const labelIds = detail.data.labelIds || [];

          const isRead = !labelIds.includes("UNREAD");

          return {
            id: message.id,
            sender: from,
            to,
            subject,

            preview: detail.data.snippet || "",

            time: date,

            internalDate,

            // TRUE  = READ
            // FALSE = UNREAD
            isRead,
          };
        } catch (error) {
          console.error("Error fetching message:", message.id, error);

          return null;
        }
      }),
    );

    // =====================================================
    // 7. REMOVE FAILED MESSAGES
    // =====================================================

    const validMessages = messages.filter(
      (message): message is NonNullable<typeof message> => message !== null,
    );

    // =====================================================
    // 8. SORT NEWEST → OLDEST
    // =====================================================

    validMessages.sort((a, b) => b.internalDate - a.internalDate);

    // =====================================================
    // 9. UNREAD COUNT
    // =====================================================

    const unreadCount = validMessages.filter(
      (message) => !message.isRead,
    ).length;

    console.log("Unread count:", unreadCount);

    console.log(
      "Newest email:",
      validMessages[0]
        ? {
            subject: validMessages[0].subject,
            date: validMessages[0].time,
          }
        : "None",
    );

    // =====================================================
    // 10. RETURN
    // =====================================================

    return NextResponse.json({
      success: true,

      messages: validMessages,

      total: validMessages.length,

      unreadCount,

      query,
    });
  } catch (error: any) {
    console.error("Gmail messages error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch Gmail messages",
      },
      {
        status: 500,
      },
    );
  }
}
