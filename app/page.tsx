"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

type Email = {
  id: string;
  sender: string;
  to?: string;
  subject: string;
  preview: string;
  time: string;
  internalDate?: number;
  isRead?: boolean;
};

type EmailDetail = {
  id: string;
  threadId?: string;
  sender: string;
  to: string;
  subject: string;
  body: string;
  time: string;
  isRead?: boolean;
  wasUnread?: boolean;
};

export default function Home() {
  // =========================================================
  // AUTH
  // =========================================================

  const { status } = useSession();
  const router = useRouter();

  // =========================================================
  // EMAIL STATE
  // =========================================================

  const [emails, setEmails] = useState<Email[]>([]);
  const [folder, setFolder] = useState<"inbox" | "sent">("inbox");
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);

  // =========================================================
  // LOADING / ERROR
  // =========================================================

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // FILTER
  // =========================================================

  const [activeFilter, setActiveFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const [filterKeyword, setFilterKeyword] = useState("");
  const [filterSender, setFilterSender] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  const [filterReadStatus, setFilterReadStatus] = useState<
    "all" | "read" | "unread"
  >("all");

  // =========================================================
  // COMPOSE
  // =========================================================

  const [composeOpen, setComposeOpen] = useState(false);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");

  // =========================================================
  // AI
  // =========================================================

  const [aiMessage, setAiMessage] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [emailAiMessage, setEmailAiMessage] = useState("");

  // =========================================================
  // SYNC
  // =========================================================

  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  const syncRunningRef = useRef(false);
  const lastPushHistoryIdRef = useRef("");
  const watchStartedRef = useRef(false);

  // =========================================================
  // AUTH REDIRECT
  // =========================================================

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // =========================================================
  // INITIAL LOAD + PUSH
  // =========================================================

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    fetchEmails(folder);
    initializeGmailWatch();

    const interval = setInterval(() => {
      checkGmailPush();
    }, 2000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkGmailPush();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [folder, status]);

  // =========================================================
  // BUILD FILTER QUERY
  // =========================================================

  function buildFilterQuery() {
    const queryParts: string[] = [];

    if (filterKeyword.trim()) {
      queryParts.push(`"${filterKeyword.trim()}"`);
    }

    if (filterSender.trim()) {
      queryParts.push(`from:${filterSender.trim()}`);
    }

    if (filterFromDate) {
      const fromDate = new Date(`${filterFromDate}T00:00:00`);

      const year = fromDate.getFullYear();
      const month = String(fromDate.getMonth() + 1).padStart(2, "0");
      const day = String(fromDate.getDate()).padStart(2, "0");

      queryParts.push(`after:${year}/${month}/${day}`);
    }

    if (filterToDate) {
      const toDate = new Date(`${filterToDate}T00:00:00`);

      toDate.setDate(toDate.getDate() + 1);

      const year = toDate.getFullYear();
      const month = String(toDate.getMonth() + 1).padStart(2, "0");
      const day = String(toDate.getDate()).padStart(2, "0");

      queryParts.push(`before:${year}/${month}/${day}`);
    }

    if (filterReadStatus === "read") {
      queryParts.push("is:read");
    }

    if (filterReadStatus === "unread") {
      queryParts.push("is:unread");
    }

    return queryParts.join(" ");
  }

  // =========================================================
  // FETCH EMAILS
  // =========================================================

  async function fetchEmails(
    currentFolder: "inbox" | "sent",
    overrideFilter?: string,
  ) {
    try {
      setLoading(true);
      setError("");

      const query =
        overrideFilter !== undefined ? overrideFilter : activeFilter;

      let url = "";

      if (currentFolder === "inbox") {
        url = query
          ? `/api/gmail/messages?q=${encodeURIComponent(query)}`
          : "/api/gmail/messages";
      } else {
        url = "/api/gmail/sent";
      }

      const response = await fetch(url, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load emails");
      }

      const loadedEmails: Email[] = data.messages || [];

      const sortedEmails = [...loadedEmails].sort(
        (a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0),
      );

      setEmails(sortedEmails);

      if (currentFolder === "inbox") {
        setUnreadCount(Number(data.unreadCount || 0));
      }

      setLastSynced(new Date());
    } catch (error: any) {
      console.error("Fetch emails error:", error);

      setError(error.message || "Failed to load emails");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // APPLY UI FILTERS
  // =========================================================

  async function applyUiFilters() {
    if (folder === "sent") {
      setAiResponse(
        "Filters are currently available for Inbox. Open Inbox to use filters.",
      );

      return;
    }

    const query = buildFilterQuery();

    try {
      setLoading(true);
      setError("");

      setSelectedEmail(null);
      setComposeOpen(false);

      setActiveFilter(query);

      const url = query
        ? `/api/gmail/messages?q=${encodeURIComponent(query)}`
        : "/api/gmail/messages";

      const response = await fetch(url, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to apply filters");
      }

      const results: Email[] = data.messages || [];

      const sortedResults = [...results].sort(
        (a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0),
      );

      setEmails(sortedResults);

      if (data.unreadCount !== undefined) {
        setUnreadCount(Number(data.unreadCount || 0));
      }

      setAiResponse(
        query
          ? `Filters applied. Found ${sortedResults.length} email(s).`
          : `Showing all emails. Found ${sortedResults.length} email(s).`,
      );

      setFilterOpen(false);
      setLastSynced(new Date());
    } catch (error: any) {
      console.error("UI filter error:", error);

      setError(error.message || "Failed to apply filters");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // CLEAR FILTER
  // =========================================================

  function clearFilter() {
    setActiveFilter("");

    setFilterKeyword("");
    setFilterSender("");
    setFilterFromDate("");
    setFilterToDate("");
    setFilterReadStatus("all");

    setAiResponse("");
    setError("");

    fetchEmails(folder, "");
  }

  // =========================================================
  // MANUAL SYNC
  // =========================================================

  async function syncEmails() {
    if (syncRunningRef.current) {
      return;
    }

    try {
      syncRunningRef.current = true;
      setSyncing(true);

      const query = activeFilter;

      const url =
        folder === "inbox"
          ? query
            ? `/api/gmail/messages?q=${encodeURIComponent(query)}`
            : "/api/gmail/messages"
          : "/api/gmail/sent";

      const response = await fetch(url, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gmail sync failed");
      }

      const latestEmails: Email[] = data.messages || [];

      const sortedEmails = [...latestEmails].sort(
        (a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0),
      );

      setEmails(sortedEmails);

      if (folder === "inbox") {
        setUnreadCount(Number(data.unreadCount || 0));
      }

      setLastSynced(new Date());
      setError("");
    } catch (error: any) {
      console.error("Real-time Gmail sync error:", error);
    } finally {
      syncRunningRef.current = false;
      setSyncing(false);
    }
  }

  // =========================================================
  // GMAIL WATCH
  // =========================================================

  async function initializeGmailWatch() {
    if (watchStartedRef.current) {
      return;
    }

    watchStartedRef.current = true;

    try {
      const response = await fetch("/api/gmail/watch", {
        method: "POST",
      });

      const data = await response.json();

      console.log("Gmail Watch:", data);

      if (!response.ok) {
        console.error("Gmail Watch activation failed:", data.error);

        watchStartedRef.current = false;
        return;
      }

      lastPushHistoryIdRef.current = data.historyId || "";

      console.log("Gmail Watch activated successfully", data);
    } catch (error) {
      console.error("Gmail Watch error:", error);

      watchStartedRef.current = false;
    }
  }

  // =========================================================
  // CHECK GMAIL PUSH
  // =========================================================

  async function checkGmailPush() {
    try {
      const response = await fetch("/api/gmail/push/status", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      const notification = data.notification;

      if (!notification?.historyId) {
        return;
      }

      if (lastPushHistoryIdRef.current === notification.historyId) {
        return;
      }

      console.log("New Gmail push notification:", notification);

      lastPushHistoryIdRef.current = notification.historyId;

      const syncResponse = await fetch("/api/gmail/push/sync", {
        method: "POST",
        cache: "no-store",
      });

      const syncData = await syncResponse.json();

      console.log("Gmail push sync:", syncData);

      if (syncData.changed || syncData.fullSyncRequired) {
        await fetchEmails(folder);

        setPushMessage("New email received");

        setTimeout(() => {
          setPushMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("Push check error:", error);
    }
  }

  // =========================================================
  // OPEN EMAIL
  // =========================================================

  async function openEmail(id: string) {
    try {
      setDetailLoading(true);

      setSelectedEmail(null);
      setComposeOpen(false);
      setError("");
      setAiResponse("");
      setEmailAiMessage("");

      const response = await fetch(`/api/gmail/message/${id}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open email");
      }

      const openedEmail: EmailDetail = data.message || data;

      setSelectedEmail(openedEmail);

      if (data.wasUnread) {
        setUnreadCount((previous) => Math.max(0, previous - 1));

        setEmails((previousEmails) =>
          previousEmails.map((email) =>
            email.id === id
              ? {
                  ...email,
                  isRead: true,
                }
              : email,
          ),
        );
      }
    } catch (error: any) {
      console.error("Open email error:", error);

      setError(error.message || "Failed to open email");
    } finally {
      setDetailLoading(false);
    }
  }

  // =========================================================
  // OPEN EMAIL FROM AI
  // =========================================================

  async function openEmailFromAI(query: string) {
    try {
      if (!query.trim()) {
        setAiResponse(
          "I need some information about the email you want to open.",
        );

        return;
      }

      setAiLoading(true);

      setAiResponse("Finding the latest matching email...");

      setComposeOpen(false);
      setSelectedEmail(null);
      setError("");

      const response = await fetch(
        `/api/gmail/messages?q=${encodeURIComponent(query)}`,
        {
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to search emails");
      }

      const results: Email[] = data.messages || [];

      if (results.length === 0) {
        setAiResponse(`I couldn't find an email matching "${query}".`);

        return;
      }

      const sortedResults = [...results].sort(
        (a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0),
      );

      const latestEmail = sortedResults[0];

      if (!latestEmail?.id) {
        throw new Error("The matching email does not have a valid ID.");
      }

      await openEmail(latestEmail.id);

      setAiResponse(
        `Opened the latest matching email: ${
          latestEmail.subject || "(No subject)"
        }`,
      );
    } catch (error: any) {
      console.error("AI open email error:", error);

      setAiResponse(error.message || "Failed to open the requested email.");
    } finally {
      setAiLoading(false);
    }
  }

  // =========================================================
  // COMPOSE
  // =========================================================

  function openCompose() {
    setComposeOpen(true);
    setSelectedEmail(null);

    setTo("");
    setSubject("");
    setBody("");

    setAiResponse("");
    setAiMessage("");
    setEmailAiMessage("");
    setSendMessage("");
  }

  function closeCompose() {
    setComposeOpen(false);

    setTo("");
    setSubject("");
    setBody("");

    setSendMessage("");
    setAiMessage("");
  }

  // =========================================================
  // NORMAL REPLY
  // =========================================================

  function openReply() {
    if (!selectedEmail) {
      return;
    }

    const replySubject = selectedEmail.subject
      ? selectedEmail.subject.toLowerCase().startsWith("re:")
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`
      : "Re:";

    setComposeOpen(true);
    setTo(selectedEmail.sender || "");
    setSubject(replySubject);
    setBody("");

    setSendMessage("");
    setAiResponse("");
    setAiMessage("");

    setSelectedEmail(null);
  }

  // =========================================================
  // AI REPLY
  // =========================================================

  async function startAIReply() {
    if (!selectedEmail) {
      return;
    }

    const prompt = "Reply to this email professionally and appropriately.";

    try {
      setAiLoading(true);

      setAiResponse("Generating an AI reply...");

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: prompt,
          currentSubject: "",
          currentBody: "",
          emailSubject: selectedEmail.subject || "",
          emailBody: selectedEmail.body || "",
          emailSender: selectedEmail.sender || "",
          emailTo: selectedEmail.to || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate AI reply");
      }

      const aiData = data.data || {};

      setComposeOpen(true);

      setTo(aiData.to || selectedEmail.sender || "");

      setSubject(
        aiData.subject ||
          (selectedEmail.subject ? `Re: ${selectedEmail.subject}` : "Re:"),
      );

      setBody(aiData.body || aiData.response || "");

      setSendMessage("");
      setSelectedEmail(null);

      setAiResponse("AI has prepared your reply. Review it before sending.");
    } catch (error: any) {
      console.error("AI reply error:", error);

      setAiResponse(error.message || "Failed to generate AI reply.");
    } finally {
      setAiLoading(false);
    }
  }

  // =========================================================
  // SEND EMAIL
  // =========================================================

  async function sendEmail() {
    if (!to.trim()) {
      setSendMessage("Please enter a recipient.");

      return;
    }

    if (!subject.trim()) {
      setSendMessage("Please enter a subject.");

      return;
    }

    if (!body.trim()) {
      setSendMessage("Please enter the email body.");

      return;
    }

    try {
      setSending(true);
      setSendMessage("");

      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          subject,
          body,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      setSendMessage("Email sent successfully!");

      await syncEmails();

      setTimeout(() => {
        closeCompose();
      }, 1200);
    } catch (error: any) {
      console.error("Send email error:", error);

      setSendMessage(error.message || "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  // =========================================================
  // AI CONTROLLER
  // =========================================================

  async function askAI(messageOverride?: string) {
    const message = messageOverride ?? aiMessage;

    if (!message.trim()) {
      return;
    }

    try {
      setAiLoading(true);
      setAiResponse("");

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          currentSubject: subject,
          currentBody: body,
          emailSubject: selectedEmail?.subject || "",
          emailBody: selectedEmail?.body || "",
          emailSender: selectedEmail?.sender || "",
          emailTo: selectedEmail?.to || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI request failed");
      }

      const aiData = data.data || {};

      // VIEW INBOX

      if (aiData.action === "VIEW_INBOX") {
        setFolder("inbox");
        setActiveFilter("");
        setComposeOpen(false);
        setSelectedEmail(null);

        setAiResponse("Opening your Inbox...");

        return;
      }

      // VIEW SENT

      if (aiData.action === "VIEW_SENT") {
        setFolder("sent");
        setActiveFilter("");
        setComposeOpen(false);
        setSelectedEmail(null);

        setAiResponse("Opening your Sent emails...");

        return;
      }

      // SEARCH

      if (aiData.action === "SEARCH_EMAILS") {
        const query = aiData.query || "";

        try {
          setComposeOpen(false);
          setSelectedEmail(null);
          setActiveFilter("");

          const searchUrl = query
            ? `/api/gmail/messages?q=${encodeURIComponent(query)}`
            : "/api/gmail/messages";

          const searchResponse = await fetch(searchUrl, {
            cache: "no-store",
          });

          const searchData = await searchResponse.json();

          if (!searchResponse.ok) {
            throw new Error(searchData.error || "Failed to search emails");
          }

          const results: Email[] = searchData.messages || [];

          const sortedResults = [...results].sort(
            (a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0),
          );

          setEmails(sortedResults);

          if (searchData.unreadCount !== undefined) {
            setUnreadCount(Number(searchData.unreadCount || 0));
          }

          setFolder("inbox");

          setAiResponse(`Found ${sortedResults.length} matching email(s).`);
        } catch (error: any) {
          setAiResponse(error.message || "Failed to search emails.");
        }

        return;
      }

      // FILTER

      if (aiData.action === "FILTER_EMAILS") {
        const query = aiData.query || "";

        try {
          setComposeOpen(false);
          setSelectedEmail(null);
          setError("");

          const filterUrl = query
            ? `/api/gmail/messages?q=${encodeURIComponent(query)}`
            : "/api/gmail/messages";

          const filterResponse = await fetch(filterUrl, {
            cache: "no-store",
          });

          const filterData = await filterResponse.json();

          if (!filterResponse.ok) {
            throw new Error(filterData.error || "Failed to filter emails");
          }

          const results: Email[] = filterData.messages || [];

          const sortedResults = [...results].sort(
            (a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0),
          );

          setEmails(sortedResults);

          if (filterData.unreadCount !== undefined) {
            setUnreadCount(Number(filterData.unreadCount || 0));
          }

          setFolder("inbox");
          setActiveFilter(query);

          setAiResponse(`Found ${sortedResults.length} matching email(s).`);
        } catch (error: any) {
          setAiResponse(error.message || "Failed to filter emails.");
        }

        return;
      }

      // OPEN EMAIL

      if (aiData.action === "OPEN_EMAIL") {
        await openEmailFromAI(aiData.query || "");

        return;
      }

      // COMPOSE

      if (aiData.action === "COMPOSE_EMAIL") {
        setComposeOpen(true);
        setSelectedEmail(null);

        setTo(aiData.to || "");
        setSubject(aiData.subject || "");
        setBody(aiData.body || "");

        setSendMessage("");

        setAiResponse(
          "I've prepared the email for you. Please review it before sending.",
        );

        return;
      }

      // IMPROVE

      if (aiData.action === "IMPROVE_EMAIL") {
        setComposeOpen(true);
        setSelectedEmail(null);

        if (aiData.subject) {
          setSubject(aiData.subject);
        }

        if (aiData.body) {
          setBody(aiData.body);
        }

        setAiResponse(
          "I've improved your email. Please review the changes before sending.",
        );

        return;
      }

      // REPLY

      if (aiData.action === "REPLY_EMAIL") {
        setComposeOpen(true);
        setSelectedEmail(null);

        setTo(aiData.to || "");
        setSubject(aiData.subject || "");
        setBody(aiData.body || "");

        setSendMessage("");

        setAiResponse(
          "I've prepared a reply for you. Please review it before sending.",
        );

        return;
      }

      // SUMMARY

      if (aiData.action === "SUMMARIZE_EMAIL") {
        setAiResponse(aiData.response || "I couldn't generate a summary.");

        return;
      }

      // CHAT

      if (aiData.action === "CHAT") {
        setAiResponse(aiData.response || "How can I help you?");

        return;
      }

      setAiResponse(JSON.stringify(aiData, null, 2));
    } catch (error: any) {
      console.error("AI error:", error);

      setAiResponse(error.message || "Something went wrong with the AI.");
    } finally {
      setAiLoading(false);
    }
  }

  // =========================================================
  // ASK ABOUT CURRENT EMAIL
  // =========================================================

  function askAboutCurrentEmail() {
    const message = emailAiMessage.trim();

    if (!message || !selectedEmail) {
      return;
    }

    runQuickPrompt(
      `${message}

Use the currently opened email as context.`,
    );

    setEmailAiMessage("");
  }

  // =========================================================
  // QUICK PROMPT
  // =========================================================

  function runQuickPrompt(prompt: string) {
    setAiMessage(prompt);
    askAI(prompt);
  }

  // =========================================================
  // AUTH LOADING
  // =========================================================

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto" />

          <p className="text-sm text-slate-400 mt-4">
            Checking your account...
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-5 lg:px-7 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <span className="text-xl">✉</span>
          </div>

          <div>
            <h1 className="font-bold text-lg leading-tight text-slate-800">
              AI Mail
            </h1>

            <p className="text-[11px] text-slate-400">Smart Gmail Assistant</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-full border ${
              syncing
                ? "bg-amber-50 border-amber-100"
                : "bg-emerald-50 border-emerald-100"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncing ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
              }`}
            />

            <span
              className={`text-xs font-semibold ${
                syncing ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {syncing ? "Syncing" : "Connected"}
            </span>
          </div>

          {lastSynced && (
            <span className="hidden lg:block text-xs text-slate-400">
              Synced {lastSynced.toLocaleTimeString()}
            </span>
          )}

          <span className="hidden lg:block text-xs font-medium text-slate-400">
            Gmail + Gemini
          </span>

          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold border border-blue-200">
            T
          </div>

          {/* SIGN OUT */}

          <button
            onClick={() =>
              signOut({
                callbackUrl: "/login",
              })
            }
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* =====================================================
          BODY
      ====================================================== */}

      <div className="flex h-[calc(100vh-4rem)]">
        {/* SIDEBAR */}

        <aside className="hidden md:flex w-60 lg:w-64 bg-white border-r border-slate-200 p-4 flex-col">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-3 mb-2">
            Mail
          </p>

          {/* INBOX */}

          <button
            onClick={() => {
              setFolder("inbox");
              setActiveFilter("");
              setComposeOpen(false);
              setSelectedEmail(null);
              setAiResponse("");
              setFilterOpen(false);
            }}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition ${
              folder === "inbox"
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="text-lg">📥</span>

            <span className="flex-1 text-left">Inbox</span>

            {unreadCount > 0 && (
              <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* SENT */}

          <button
            onClick={() => {
              setFolder("sent");
              setActiveFilter("");
              setComposeOpen(false);
              setSelectedEmail(null);
              setAiResponse("");
              setFilterOpen(false);
            }}
            className={`flex items-center gap-3 w-full px-4 py-3 mt-1 rounded-xl text-sm font-medium transition ${
              folder === "sent"
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="text-lg">📤</span>

            <span className="flex-1 text-left">Sent</span>
          </button>

          {/* COMPOSE */}

          <button
            onClick={openCompose}
            className="flex items-center justify-center gap-2 w-full mt-5 px-4 py-3.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 hover:shadow-md transition"
          >
            <span className="text-lg">＋</span>
            Compose
          </button>

          {/* SYNC */}

          {/* AI CARD */}

          <div className="mt-auto bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                ✨
              </div>

              <div>
                <p className="font-semibold text-sm text-slate-700">
                  AI Assistant
                </p>

                <p className="text-[10px] text-slate-400">Gemini powered</p>
              </div>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Search, filter, compose, summarize and reply using natural
              language.
            </p>
          </div>
        </aside>

        {/* ===================================================
            EMAIL LIST
        ==================================================== */}

        <section className="w-full md:w-[360px] lg:w-[400px] xl:w-[430px] bg-white border-r border-slate-200 flex flex-col">
          {/* HEADER */}

          <div className="px-5 py-4 border-b border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-800">
                    {folder === "inbox" ? "Inbox" : "Sent"}
                  </h2>

                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {emails.length}
                  </span>

                  {folder === "inbox" && unreadCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-1">
                  Your recent email activity
                </p>
              </div>

              <button
                onClick={syncEmails}
                disabled={syncing}
                className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition"
                title="Sync now"
              >
                <span className={syncing ? "inline-block animate-spin" : ""}>
                  ↻
                </span>
              </button>
            </div>

            {/* PUSH STATUS */}

            {pushMessage && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">
                ✓ {pushMessage}
              </div>
            )}

            {/* ACTIVE FILTER */}

            {activeFilter && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 truncate max-w-[270px]">
                  🔎 {activeFilter}
                </span>

                <button
                  onClick={clearFilter}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* SEARCH + FILTER */}

          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                🔍
              </span>

              <input
                type="text"
                placeholder="Search your emails..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 focus:bg-white transition"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const value = e.currentTarget.value.trim();

                    if (value) {
                      runQuickPrompt(`Search my emails for ${value}`);
                    }
                  }
                }}
              />
            </div>

            {/* FILTER BUTTON */}

            <button
              onClick={() => setFilterOpen((previous) => !previous)}
              className={`w-full mt-3 flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
                filterOpen
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <span>⚙️</span>
                Filters
              </span>

              <span>{filterOpen ? "▲" : "▼"}</span>
            </button>

            {/* FILTER PANEL */}

            {filterOpen && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    Keyword
                  </label>

                  <input
                    value={filterKeyword}
                    onChange={(e) => setFilterKeyword(e.target.value)}
                    placeholder="Search keyword..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    Sender
                  </label>

                  <input
                    value={filterSender}
                    onChange={(e) => setFilterSender(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      From
                    </label>

                    <input
                      type="date"
                      value={filterFromDate}
                      onChange={(e) => setFilterFromDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      To
                    </label>

                    <input
                      type="date"
                      value={filterToDate}
                      onChange={(e) => setFilterToDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    Read status
                  </label>

                  <select
                    value={filterReadStatus}
                    onChange={(e) =>
                      setFilterReadStatus(
                        e.target.value as "all" | "read" | "unread",
                      )
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                  >
                    <option value="all">All emails</option>

                    <option value="read">Read</option>

                    <option value="unread">Unread</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={applyUiFilters}
                    className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
                  >
                    Apply Filters
                  </button>

                  <button
                    onClick={clearFilter}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MAIL LIST */}

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 space-y-5">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200" />

                      <div className="flex-1">
                        <div className="h-3.5 bg-slate-200 rounded w-3/4" />

                        <div className="h-3 bg-slate-100 rounded w-full mt-2" />

                        <div className="h-3 bg-slate-100 rounded w-5/6 mt-2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-6">
                <div className="rounded-2xl bg-red-50 border border-red-100 p-5">
                  <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center mb-3">
                    ⚠️
                  </div>

                  <p className="text-sm font-medium text-red-700">
                    Unable to load emails
                  </p>

                  <p className="text-xs text-red-500 mt-1 leading-5">{error}</p>

                  <button
                    onClick={() => fetchEmails(folder)}
                    className="mt-4 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-50"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">
                  ✉️
                </div>

                <h3 className="font-semibold text-slate-700">
                  No emails found
                </h3>

                <p className="text-xs text-slate-400 mt-1 max-w-[230px] leading-5">
                  Your mailbox doesn't contain any emails matching this view.
                </p>
              </div>
            ) : (
              emails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;

                const isUnread = email.isRead === false;

                return (
                  <button
                    key={email.id}
                    onClick={() => openEmail(email.id)}
                    className={`w-full text-left px-5 py-4 border-b border-slate-100 transition ${
                      isSelected
                        ? "bg-blue-50 border-l-4 border-l-blue-600 pl-[16px]"
                        : isUnread
                          ? "bg-blue-50/40 hover:bg-blue-50"
                          : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : isUnread
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {(email.sender || "U").charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {isUnread && !isSelected && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                            )}

                            <span
                              className={`text-sm truncate ${
                                isSelected
                                  ? "font-bold text-blue-800"
                                  : isUnread
                                    ? "font-bold text-slate-900"
                                    : "font-medium text-slate-600"
                              }`}
                            >
                              {email.sender}
                            </span>
                          </div>

                          <span
                            className={`text-[10px] whitespace-nowrap ${
                              isUnread
                                ? "text-blue-600 font-semibold"
                                : "text-slate-400"
                            }`}
                          >
                            {email.time}
                          </span>
                        </div>

                        <div
                          className={`truncate mt-1 text-sm ${
                            isUnread
                              ? "font-bold text-slate-800"
                              : "font-medium text-slate-600"
                          }`}
                        >
                          {email.subject || "(No subject)"}
                        </div>

                        <div
                          className={`truncate mt-1 text-xs leading-5 ${
                            isUnread ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          {email.preview || "No preview available"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* ===================================================
            MAIN AREA
        ==================================================== */}

        <section className="hidden md:block flex-1 bg-slate-50 overflow-y-auto">
          {/* =================================================
              COMPOSE
          ================================================== */}

          {composeOpen ? (
            <div className="max-w-4xl mx-auto p-5 lg:p-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      ✏️
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-slate-800">
                        Compose email
                      </h2>

                      <p className="text-xs text-slate-400 mt-1">
                        Review your message before sending.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={closeCompose}
                    className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-400 transition"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      To
                    </label>

                    <input
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Subject
                    </label>

                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Enter email subject"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Message
                    </label>

                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write your message..."
                      rows={13}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none text-sm resize-none leading-6 focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                    />
                  </div>

                  <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 p-3">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span>✨</span>

                      <span className="text-xs font-semibold text-purple-700">
                        AI writing assistant
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        value={aiMessage}
                        onChange={(e) => setAiMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !aiLoading) {
                            askAI();
                          }
                        }}
                        placeholder='Try "Make this professional"'
                        className="flex-1 bg-white border border-purple-100 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200"
                      />

                      <button
                        onClick={() => askAI()}
                        disabled={aiLoading || !body.trim()}
                        className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition"
                      >
                        {aiLoading ? "Working..." : "✨ Improve"}
                      </button>
                    </div>
                  </div>

                  {aiResponse && (
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                      <div className="flex items-center gap-2">
                        <span>🤖</span>

                        <p className="text-sm text-blue-700">{aiResponse}</p>
                      </div>
                    </div>
                  )}

                  {sendMessage && (
                    <div
                      className={`rounded-xl px-4 py-3 text-sm border ${
                        sendMessage.includes("successfully")
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-red-50 text-red-700 border-red-100"
                      }`}
                    >
                      {sendMessage}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2">
                    <p className="text-[11px] text-slate-400">
                      Your email will only be sent after you click Send.
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={closeCompose}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={sendEmail}
                        disabled={sending}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {sending ? "Sending..." : "Send email"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto" />

                <p className="text-sm text-slate-400 mt-4">Loading email...</p>
              </div>
            </div>
          ) : selectedEmail ? (
            /* EMAIL DETAIL */

            <div className="max-w-4xl mx-auto p-5 lg:p-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-6 border-b border-slate-200">
                  <div className="flex justify-between gap-5">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full mb-3">
                        ✉ Opened email
                      </div>

                      <h2 className="text-2xl font-bold text-slate-800 leading-tight break-words">
                        {selectedEmail.subject || "(No subject)"}
                      </h2>
                    </div>

                    <button
                      onClick={() => setSelectedEmail(null)}
                      className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0 transition"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-6 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                      {(selectedEmail.sender || "U").charAt(0).toUpperCase()}
                    </div>

                    <div className="text-sm min-w-0">
                      <p className="font-semibold text-slate-700 truncate">
                        {selectedEmail.sender}
                      </p>

                      <p className="text-xs text-slate-400 mt-1">
                        To: {selectedEmail.to || "Unknown"}
                      </p>

                      <p className="text-xs text-slate-400">
                        {selectedEmail.time}
                      </p>

                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Read
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-7">
                  <div className="whitespace-pre-wrap text-sm text-slate-700 leading-7">
                    {selectedEmail.body}
                  </div>
                </div>

                <div className="px-6 pb-6">
                  <div className="border-t border-slate-100 pt-5">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={openReply}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                      >
                        ↩ Reply
                      </button>

                      <button
                        onClick={startAIReply}
                        disabled={aiLoading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                      >
                        ✨ {aiLoading ? "Generating..." : "AI Reply"}
                      </button>

                      <button
                        onClick={() => runQuickPrompt("Summarize this email")}
                        disabled={aiLoading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition shadow-sm"
                      >
                        ✨ {aiLoading ? "Working..." : "Summarize"}
                      </button>
                    </div>

                    <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-3">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                          🤖
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            Ask AI about this email
                          </p>

                          <p className="text-[10px] text-slate-400">
                            The opened email will be used as context.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          value={emailAiMessage}
                          onChange={(e) => setEmailAiMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !aiLoading) {
                              askAboutCurrentEmail();
                            }
                          }}
                          placeholder='e.g. "What action is required?"'
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300"
                        />

                        <button
                          onClick={askAboutCurrentEmail}
                          disabled={aiLoading || !emailAiMessage.trim()}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50 transition"
                        >
                          Ask
                        </button>
                      </div>
                    </div>

                    {aiResponse && (
                      <div className="mt-4 rounded-2xl bg-purple-50 border border-purple-100 p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            ✨
                          </span>

                          <div>
                            <h3 className="font-semibold text-sm text-purple-800">
                              AI Assistant
                            </h3>

                            <p className="text-[10px] text-purple-400">
                              Gemini response
                            </p>
                          </div>
                        </div>

                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-6">
                          {aiResponse}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* AI HOME */

            <div className="max-w-5xl mx-auto p-5 lg:p-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-8 lg:px-10 lg:py-10">
                  <div className="max-w-2xl">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl shadow-sm mb-5">
                      ✨
                    </div>

                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-semibold text-blue-600 mb-4">
                      🤖 AI-POWERED MAIL
                    </div>

                    <h2 className="text-3xl font-bold text-slate-800">
                      AI Mail Assistant
                    </h2>

                    <p className="text-sm text-slate-500 mt-2 leading-6">
                      Manage your Gmail using natural language. Search messages,
                      compose emails, summarize conversations, generate replies
                      and more.
                    </p>
                  </div>

                  {/* QUICK ACTIONS */}

                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Quick actions
                      </p>

                      <span className="text-[10px] text-slate-400">
                        One click
                      </span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      <QuickAction
                        icon="📥"
                        title="Show Inbox"
                        subtitle="View incoming mail"
                        onClick={() => runQuickPrompt("Show my inbox")}
                      />

                      <QuickAction
                        icon="📤"
                        title="Show Sent"
                        subtitle="View sent messages"
                        onClick={() => runQuickPrompt("Show my sent emails")}
                      />

                      <QuickAction
                        icon="🔍"
                        title="Search Emails"
                        subtitle="Find a specific message"
                        onClick={() => runQuickPrompt("Search my emails")}
                      />

                      <QuickAction
                        icon="✏️"
                        title="Compose"
                        subtitle="Create a new email"
                        onClick={() => runQuickPrompt("Compose an email")}
                      />

                      <QuickAction
                        icon="📩"
                        title="Open Latest"
                        subtitle="Read your latest email"
                        onClick={() => runQuickPrompt("Open the latest email")}
                      />

                      <QuickAction
                        icon="📊"
                        title="Unread Emails"
                        subtitle="Show unread messages"
                        onClick={() => runQuickPrompt("Show unread emails")}
                      />
                    </div>
                  </div>

                  {/* AI INPUT */}

                  <div className="mt-8">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 flex gap-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition">
                      <div className="flex-1 flex items-center">
                        <span className="ml-2 text-slate-400">✨</span>

                        <input
                          value={aiMessage}
                          onChange={(e) => setAiMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !aiLoading) {
                              askAI();
                            }
                          }}
                          placeholder="Ask your AI mail assistant..."
                          className="flex-1 bg-transparent px-3 py-3 outline-none text-sm"
                        />
                      </div>

                      <button
                        onClick={() => askAI()}
                        disabled={aiLoading || !aiMessage.trim()}
                        className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {aiLoading ? "Thinking..." : "Ask AI"}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <Suggestion
                        text="Show unread emails"
                        onClick={() => runQuickPrompt("Show unread emails")}
                      />

                      <Suggestion
                        text="Find emails from Google"
                        onClick={() =>
                          runQuickPrompt("Find emails from Google")
                        }
                      />

                      <Suggestion
                        text="Compose an email"
                        onClick={() => runQuickPrompt("Compose an email")}
                      />
                    </div>
                  </div>

                  {aiResponse && (
                    <div className="mt-6 rounded-2xl bg-blue-50 border border-blue-100 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          🤖
                        </span>

                        <div>
                          <span className="text-sm font-semibold text-blue-800">
                            AI Assistant
                          </span>

                          <p className="text-[10px] text-blue-400">
                            Gemini response
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-6">
                        {aiResponse}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// ===========================================================
// QUICK ACTION
// ===========================================================

function QuickAction({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm transition group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-white flex items-center justify-center text-lg flex-shrink-0 transition">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">{title}</p>

          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {subtitle}
          </p>
        </div>
      </div>
    </button>
  );
}

// ===========================================================
// AI SUGGESTION
// ===========================================================

function Suggestion({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-100 text-[11px] text-slate-500 hover:text-blue-600 transition"
    >
      {text}
    </button>
  );
}
