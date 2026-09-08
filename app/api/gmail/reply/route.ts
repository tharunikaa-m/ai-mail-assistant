import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session: any = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { messageId, body } = await request.json();

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 },
      );
    }

    if (!body || !body.trim()) {
      return NextResponse.json(
        { error: "Reply body is required" },
        { status: 400 },
      );
    }

    const auth = new google.auth.OAuth2();

    auth.setCredentials({
      access_token: session.accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth,
    });

    // Get the original email
    const original = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["From", "To", "Subject", "Message-ID"],
    });

    const headers = original.data.payload?.headers || [];

    const getHeader = (name: string) =>
      headers.find(
        (header) => header.name?.toLowerCase() === name.toLowerCase(),
      )?.value || "";

    const from = getHeader("From");
    const subject = getHeader("Subject");
    const messageIdHeader = getHeader("Message-ID");

    if (!from) {
      return NextResponse.json(
        { error: "Unable to determine original sender" },
        { status: 400 },
      );
    }

    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

    const rawMessage = [
      `To: ${from}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${messageIdHeader}`,
      `References: ${messageIdHeader}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body.trim(),
    ].join("\r\n");

    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
        threadId: original.data.threadId || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: response.data.id,
    });
  } catch (error) {
    console.error("Gmail reply error:", error);

    return NextResponse.json(
      {
        error: "Failed to send reply",
      },
      { status: 500 },
    );
  }
}
