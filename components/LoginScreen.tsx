'use client';

import React from 'react';

export default function LoginScreen() {
  return (
    <div className="bg-surface text-on-surface font-body selection:bg-primary/30 selection:text-primary min-h-screen flex flex-col items-center justify-center overflow-x-hidden">
      {/* Hero Background Section (Top/Left focus) */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-container-lowest to-surface"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface-container-low/40 to-surface"></div>
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-primary/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-tertiary/20 rounded-full blur-3xl"></div>
      </div>

      {/* Main Content Canvas */}
      <main className="relative z-10 w-full max-w-7xl px-6 py-12 md:flex md:items-center md:justify-center lg:px-24">
        {/* Branding & Headline Section */}
        <div className="w-full max-w-md space-y-8">
          <header className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-headline italic font-bold tracking-tighter text-primary">Suzy AI</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-headline font-bold text-tertiary leading-tight tracking-tight">
              Welcome back, <br />
              <span className="text-tertiary italic">Beautiful.</span>
            </h1>
            <p className="text-secondary max-w-sm text-lg font-light leading-relaxed">
              Step back into your sanctuary of personalized intelligence and effortless elegance.
            </p>
          </header>

          {/* Login Form Container (Nesting Rule Applied) */}
          <div className="velvet-glow rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-outline-variant/10">
            <div className="glass-panel p-8 md:p-10 rounded-lg">
            <form action="/chat" className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-label font-semibold text-secondary uppercase tracking-widest pl-2">Email Address</label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    className="w-full bg-surface-container-highest border-none rounded-md px-6 py-4 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary/40 focus:outline-none transition-all duration-300"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-2">
                  <label htmlFor="password" className="block text-sm font-label font-semibold text-secondary uppercase tracking-widest">Password</label>
                  <a id="forgot-password-link" className="text-xs text-primary/80 hover:text-primary transition-colors" href="#">Forgot?</a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-surface-container-highest border-none rounded-md px-6 py-4 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary/40 focus:outline-none transition-all duration-300"
                  />
                </div>
              </div>

              {/* Primary Action (Jeweled Button) */}
              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 py-4 rounded-xl text-on-primary font-bold text-lg shadow-[0_10px_30px_rgba(255,112,149,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-300 flex justify-center items-center gap-2"
              >
                Login
                <span className="material-symbols-outlined" data-icon="arrow_forward">arrow_forward</span>
              </button>
            </form>

            {/* Divider (Feathered/Low Opacity) */}
            <div className="relative my-8 flex items-center">
              <div className="flex-grow border-t border-outline-variant/20"></div>
              <span className="flex-shrink mx-4 text-xs font-label uppercase tracking-[0.2em] text-outline">or connect with</span>
              <div className="flex-grow border-t border-outline-variant/20"></div>
            </div>

            {/* Social Login Cluster */}
            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-3 bg-surface-container-high hover:bg-surface-bright py-3 rounded-md transition-all duration-200 group">
                <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform" data-icon="account_circle">account_circle</span>
                <span className="text-sm font-semibold">Google</span>
              </button>
              <button className="flex items-center justify-center gap-3 bg-surface-container-high hover:bg-surface-bright py-3 rounded-md transition-all duration-200 group">
                <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform" data-icon="apple">ios</span>
                <span className="text-sm font-semibold">Apple</span>
              </button>
            </div>
            </div>
          </div>

          {/* Footer Link */}
          <footer className="text-center md:text-left pt-4">
            <p className="text-on-surface-variant font-light">
              Don&apos;t have an account?
              <a id="cta-join-link" className="text-primary font-bold ml-1 hover:underline underline-offset-8 transition-all" href="#">Join the inner circle</a>
            </p>
          </footer>
        </div>

        {/* Right Side: Decorative Image Card (Visible on larger screens) */}
        {/* Intentionally empty — no stock photos per design requirements */}
      </main>

      {/* Contextual Support Icon (Bottom Right) */}
      <div className="fixed bottom-8 right-8 z-50">
        <button className="w-14 h-14 bg-surface-container-highest rounded-full flex items-center justify-center shadow-lg border border-outline-variant/20 hover:border-tertiary/40 transition-all duration-300 group">
          <span className="material-symbols-outlined text-tertiary group-hover:rotate-12 transition-transform" data-icon="support_agent">support_agent</span>
        </button>
      </div>
    </div>
  );
}
