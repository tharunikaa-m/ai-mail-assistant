import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,

    notification: globalThis.__gmailPushNotification || null,
  });
}
