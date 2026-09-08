import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json(
        {
          error: "Not authenticated",
        },
        { status: 401 },
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

    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SENT"],
      maxResults: 10,
    });

    const messages = response.data.messages || [];

    const emailDetails = await Promise.all(
      messages.map(async (message) => {
        if (!message.id) {
          return null;
        }

        const email = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });

        const headers = email.data.payload?.headers || [];

        const getHeader = (name: string) => {
          return (
            headers.find(
              (header) => header.name?.toLowerCase() === name.toLowerCase(),
            )?.value || ""
          );
        };

        return {
          id: message.id,
          sender: getHeader("From"),
          subject: getHeader("Subject"),
          preview: email.data.snippet || "",
          time: getHeader("Date"),
          from: getHeader("From"),
          to: getHeader("To"),
        };
      }),
    );

    return NextResponse.json({
      messages: emailDetails.filter(Boolean),
    });
  } catch (error: any) {
    console.error("========== SENT API ERROR ==========");
    console.error("Message:", error?.message);
    console.error("Code:", error?.code);
    console.error("Response:", error?.response?.data);
    console.error("====================================");

    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch sent emails",
        code: error?.code || null,
        details: error?.response?.data || null,
      },
      { status: 500 },
    );
  }
}
