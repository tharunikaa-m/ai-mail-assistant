import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";

// =========================================================
// GET EMAIL
// =========================================================

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
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
    // 2. GET MESSAGE ID
    // =====================================================

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Email ID is required",
        },
        {
          status: 400,
        },
      );
    }

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
    // 5. FETCH EMAIL
    // =====================================================

    const response = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    const message = response.data;

    // =====================================================
    // 6. CHECK IF UNREAD
    // =====================================================

    const labelIds = message.labelIds || [];

    const wasUnread = labelIds.includes("UNREAD");

    // =====================================================
    // 7. MARK AS READ
    // =====================================================

    if (wasUnread) {
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });

      console.log(`Email ${id} marked as read`);
    }

    // =====================================================
    // 8. EMAIL HEADERS
    // =====================================================

    const headers = message.payload?.headers || [];

    function getHeader(name: string): string {
      const header = headers.find(
        (header) => header.name?.toLowerCase() === name.toLowerCase(),
      );

      return header?.value || "";
    }

    // =====================================================
    // 9. DECODE BODY
    // =====================================================

    function decodeBase64(data: string): string {
      try {
        return Buffer.from(data, "base64url").toString("utf-8");
      } catch {
        try {
          return Buffer.from(data, "base64").toString("utf-8");
        } catch {
          return "";
        }
      }
    }

    function extractBody(payload: any): string {
      if (!payload) {
        return "";
      }

      if (payload.body?.data) {
        return decodeBase64(payload.body.data);
      }

      if (payload.parts) {
        // Prefer text/plain
        for (const part of payload.parts) {
          if (part.mimeType === "text/plain" && part.body?.data) {
            return decodeBase64(part.body.data);
          }
        }

        // Recursive search
        for (const part of payload.parts) {
          const result = extractBody(part);

          if (result) {
            return result;
          }
        }
      }

      return "";
    }

    const body = extractBody(message.payload);

    // =====================================================
    // 10. CREATE EMAIL OBJECT
    // =====================================================

    const email = {
      id: message.id || "",
      threadId: message.threadId || "",
      sender: getHeader("From"),
      to: getHeader("To"),
      subject: getHeader("Subject") || "(No subject)",
      body,
      time: getHeader("Date"),
      isRead: true,
    };

    // =====================================================
    // 11. RETURN
    // =====================================================

    return NextResponse.json({
      success: true,
      message: email,
      wasUnread,
    });
  } catch (error: any) {
    console.error("Gmail message error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch email",
      },
      {
        status: 500,
      },
    );
  }
}

// =========================================================
// DELETE EMAIL
// =========================================================

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
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
    // 2. GET MESSAGE ID
    // =====================================================

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Email ID is required",
        },
        {
          status: 400,
        },
      );
    }

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
    // 5. MOVE EMAIL TO TRASH
    // =====================================================

    await gmail.users.messages.trash({
      userId: "me",
      id,
    });

    console.log(`Email ${id} moved to Gmail Trash`);

    // =====================================================
    // 6. RETURN SUCCESS
    // =====================================================

    return NextResponse.json({
      success: true,
      message: "Email deleted successfully",
      id,
    });
  } catch (error: any) {
    console.error("Gmail delete error:", error);

    return NextResponse.json(
      {
        error:
          error?.response?.data?.error?.message ||
          error?.message ||
          "Failed to delete email",
      },
      {
        status: 500,
      },
    );
  }
}
