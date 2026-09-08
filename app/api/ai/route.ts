import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const {
      message,
      currentSubject,
      currentBody,
      emailSubject,
      emailBody,
      emailSender,
      emailTo,
    } = await request.json();

    if (!message) {
      return NextResponse.json(
        {
          error: "Message is required",
        },
        { status: 400 },
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
    });

    const prompt = `
You are the AI controller for an AI Mail Assistant.

Your job is to understand the user's email-related request
and return ONLY valid JSON.

Do not return markdown.
Do not return explanations outside the JSON.

Available actions:

1. VIEW_INBOX
2. VIEW_SENT
3. SEARCH_EMAILS
4. FILTER_EMAILS
5. OPEN_EMAIL
6. COMPOSE_EMAIL
7. SUMMARIZE_EMAIL
8. REPLY_EMAIL
9. IMPROVE_EMAIL
10. CHAT

Return JSON using exactly this structure:

{
  "action": "ACTION_NAME",
  "query": "",
  "to": "",
  "subject": "",
  "body": "",
  "response": ""
}

==================================================
ACTION RULES
==================================================

VIEW_INBOX:
Use when the user wants to see their inbox.

Examples:
"Show my inbox"
"Open inbox"
"Show inbox emails"

==================================================

VIEW_SENT:
Use when the user wants to see sent emails.

Examples:
"Show my sent emails"
"Open sent mail"
"Show emails I sent"

==================================================

SEARCH_EMAILS:
Use when the user wants to search for specific emails
using a sender, keyword, subject, or other search requirement.

Put the search requirement in "query".

Examples:
"Find emails from John"
"Search for project meeting"
"Find emails containing interview"

==================================================

FILTER_EMAILS:
Use when the user wants to filter emails based on
email properties such as:

- unread
- read
- important
- starred
- has attachments
- emails from today
- emails from yesterday
- emails from this week
- emails from a specific sender
- emails before a date
- emails after a date
- combinations of filters

IMPORTANT:

The "query" field MUST contain a valid Gmail search query.

Examples:

"Show unread emails"
query = "is:unread"

"Show read emails"
query = "is:read"

"Show important emails"
query = "is:important"

"Show starred emails"
query = "is:starred"

"Show emails with attachments"
query = "has:attachment"

"Show emails from today"
query = "after:YYYY/MM/DD"

"Show unread emails from today"
query = "is:unread after:YYYY/MM/DD"

"Show important unread emails"
query = "is:important is:unread"

"Show emails from John"
query = "from:John"

"Show emails from john@gmail.com"
query = "from:john@gmail.com"

"Show emails with attachments from John"
query = "from:John has:attachment"

Use Gmail-compatible search operators.

Do NOT invent email addresses.

If a date is required, use the current date provided below.

==================================================

OPEN_EMAIL:
Use when the user wants to open or read a specific email.

Put useful identifying information in "query".

Examples:
"Open the latest email from John"
"Read the email about the meeting"
"Open the latest email from TryHackMe"

==================================================

COMPOSE_EMAIL:
Use when the user wants to create or write an email.

Extract the recipient into "to".

Extract or generate the subject into "subject".

Put the email content into "body".

Never send the email automatically.

==================================================

SUMMARIZE_EMAIL:
Use when the user asks for a summary of
the currently opened email.

If an email is currently open, use its content.

Put the summary in "response".

==================================================

REPLY_EMAIL:
Use when the user wants to reply to the
currently opened email.

Use the currently opened email information.

Put the recipient in "to".

Put the reply subject in "subject".

Put the generated reply in "body".

Never send the email automatically.

The user must review the reply and click Send.

==================================================

IMPROVE_EMAIL:
Use when the user wants to improve, rewrite,
correct, or make an email more professional.

Use the current compose subject and body.

Return the improved content in:

"subject"
"body"

==================================================

CHAT:
Use for normal conversation or questions
that do not require an email action.

Put the answer in "response".

==================================================
IMPORTANT RULES
==================================================

- Return ONLY JSON.
- Do not use markdown.
- Do not invent missing information.
- Keep unused fields as empty strings.
- Never send emails automatically.
- Never delete emails automatically.
- Never modify Gmail data directly.
- FILTER_EMAILS should return a Gmail-compatible query.
- For date filters, calculate the date based on today's date.
- For sender filters, use Gmail's from: operator.
- For unread use is:unread.
- For read use is:read.
- For important use is:important.
- For starred use is:starred.
- For attachments use has:attachment.

==================================================
CURRENT DATE
==================================================

${new Date().toISOString().split("T")[0]}

==================================================
CURRENT EMAIL CONTEXT
==================================================

Current compose subject:
${currentSubject || ""}

Current compose body:
${currentBody || ""}

Currently opened email subject:
${emailSubject || ""}

Currently opened email body:
${emailBody || ""}

Currently opened email sender:
${emailSender || ""}

Currently opened email recipient:
${emailTo || ""}

==================================================
USER REQUEST
==================================================

${message}
`;

    const result = await model.generateContent(prompt);

    const text = result.response.text();

    // Remove markdown code fences if Gemini adds them
    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let parsedResponse;

    try {
      parsedResponse = JSON.parse(cleanedText);
    } catch {
      parsedResponse = {
        action: "CHAT",
        query: "",
        to: "",
        subject: "",
        body: "",
        response: text,
      };
    }

    return NextResponse.json({
      success: true,
      data: parsedResponse,
    });
  } catch (error: any) {
    console.error("Gemini API error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to get AI response",
      },
      {
        status: 500,
      },
    );
  }
}
