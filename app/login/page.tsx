"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-200/25 blur-3xl" />
        <div className="absolute bottom-[-180px] left-1/3 w-[450px] h-[450px] rounded-full bg-purple-200/20 blur-3xl" />
      </div>

      {/* Center Content */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-6xl">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] bg-white rounded-[28px] border border-slate-200 shadow-[0_24px_80px_rgba(15,23,42,0.10)] overflow-hidden">
            {/* LEFT SIDE */}
            <section className="hidden lg:flex relative bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white p-12 xl:p-16 flex-col justify-between overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-[-100px] right-[-100px] w-80 h-80 rounded-full border border-white/10" />
              <div className="absolute top-[-70px] right-[-70px] w-56 h-56 rounded-full border border-white/10" />
              <div className="absolute bottom-[-120px] left-[-120px] w-96 h-96 rounded-full border border-white/10" />

              {/* Glow */}
              <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />

              <div className="relative">
                {/* Brand */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center text-xl">
                    ✉
                  </div>

                  <div>
                    <p className="text-sm font-semibold tracking-wide">
                      AI Mail Assistant
                    </p>

                    <p className="text-[10px] text-blue-200/70">
                      Intelligent Gmail workspace
                    </p>
                  </div>
                </div>

                {/* Hero */}
                <div className="mt-24 max-w-lg">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                    AI-powered email management
                  </div>

                  <h2 className="mt-6 text-4xl xl:text-5xl font-bold tracking-tight leading-[1.08]">
                    Work smarter with
                    <span className="block text-blue-300">your Gmail.</span>
                  </h2>

                  <p className="mt-6 text-sm xl:text-base text-slate-300 leading-7 max-w-md">
                    Search messages, compose emails, generate replies, summarize
                    conversations and manage your inbox using natural language.
                  </p>
                </div>

                {/* Feature list */}
                <div className="mt-12 space-y-4">
                  <Feature
                    icon="✦"
                    title="AI-assisted writing"
                    description="Draft and improve professional emails in seconds."
                  />

                  <Feature
                    icon="⌕"
                    title="Natural-language search"
                    description="Find the right email without remembering exact keywords."
                  />

                  <Feature
                    icon="↗"
                    title="Real-time Gmail sync"
                    description="Stay updated as new messages arrive."
                  />
                </div>
              </div>

              {/* Bottom */}
              <div className="relative mt-14">
                <div className="h-px bg-white/10" />

                <div className="flex items-center justify-between pt-5">
                  <p className="text-[11px] text-slate-400">
                    Built with Next.js · Gmail API · Gemini
                  </p>

                  <span className="text-[11px] text-slate-500">
                    Secure workspace
                  </span>
                </div>
              </div>
            </section>

            {/* RIGHT SIDE */}
            <section className="bg-white px-7 py-10 sm:px-12 lg:px-14 xl:px-16 flex items-center">
              <div className="w-full max-w-md mx-auto">
                {/* Mobile Brand */}
                <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
                  <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200">
                    ✉
                  </div>

                  <div>
                    <p className="font-bold text-slate-900">
                      AI Mail Assistant
                    </p>

                    <p className="text-[10px] text-slate-400">
                      Intelligent Gmail workspace
                    </p>
                  </div>
                </div>

                {/* Login icon */}
                <div className="flex justify-center lg:justify-start">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl">
                    👋
                  </div>
                </div>

                {/* Heading */}
                <div className="mt-7 text-center lg:text-left">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                    Welcome back
                  </p>

                  <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                    Sign in to your
                    <span className="block">AI Mail workspace</span>
                  </h1>

                  <p className="mt-4 text-sm leading-6 text-slate-500 max-w-sm mx-auto lg:mx-0">
                    Connect your Google account and let your AI assistant help
                    you manage Gmail faster.
                  </p>
                </div>

                {/* Google Login */}
                <button
                  onClick={() =>
                    signIn("google", {
                      callbackUrl: "/",
                    })
                  }
                  className="group w-full mt-9 h-14 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-sm">
                    <span className="text-sm font-bold text-slate-700">G</span>
                  </div>

                  <span className="text-sm font-semibold text-slate-800">
                    Continue with Google
                  </span>

                  <span className="ml-auto mr-4 text-slate-300 group-hover:text-slate-500 transition">
                    →
                  </span>
                </button>

                {/* Trust */}
                <div className="mt-5 flex items-center justify-center lg:justify-start gap-2 text-[11px] text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    ✓
                  </span>

                  <span>Secure authentication through Google</span>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 my-8">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-300">
                    What you can do
                  </span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                {/* Capability cards */}
                <div className="grid grid-cols-2 gap-3">
                  <MiniFeature
                    icon="🔍"
                    title="Search"
                    description="Find emails naturally"
                  />

                  <MiniFeature
                    icon="✨"
                    title="Compose"
                    description="Write with AI"
                  />

                  <MiniFeature
                    icon="↩"
                    title="Reply"
                    description="Generate responses"
                  />

                  <MiniFeature
                    icon="📊"
                    title="Summarize"
                    description="Understand faster"
                  />
                </div>

                {/* Footer */}
                <div className="mt-9 pt-6 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 text-[10px] text-slate-400">
                    <span>Gmail API</span>
                    <span>•</span>
                    <span>Google Cloud</span>
                    <span>•</span>
                    <span>Gemini AI</span>
                  </div>

                  <p className="mt-3 text-center lg:text-left text-[10px] text-slate-300">
                    Your email will be accessed only after Google
                    authentication.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Bottom page footer */}
          <p className="text-center mt-5 text-[10px] text-slate-400">
            AI Mail Assistant · Intelligent email management
          </p>
        </div>
      </div>
    </main>
  );
}

// ===========================================================
// FEATURE
// ===========================================================

function Feature({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-sm text-blue-200 flex-shrink-0">
        {icon}
      </div>

      <div>
        <p className="text-sm font-semibold text-white">{title}</p>

        <p className="mt-1 text-xs leading-5 text-slate-400 max-w-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

// ===========================================================
// MINI FEATURE
// ===========================================================

function MiniFeature({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 hover:bg-white hover:border-slate-200 hover:shadow-sm transition">
      <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-sm shadow-sm">
        {icon}
      </div>

      <p className="mt-3 text-xs font-semibold text-slate-700">{title}</p>

      <p className="mt-1 text-[10px] leading-4 text-slate-400">{description}</p>
    </div>
  );
}
