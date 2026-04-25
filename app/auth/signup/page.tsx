import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="bg-surface text-on-surface font-body selection:bg-primary/30 selection:text-primary min-h-screen flex flex-col items-center justify-center overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-container-lowest to-surface"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface-container-low/40 to-surface"></div>
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-primary/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-tertiary/20 rounded-full blur-3xl"></div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-md px-6 text-center space-y-8">
        <header className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-headline italic font-bold tracking-tighter text-primary">Suzy AI</span>
          </div>
          <div className="space-y-2">
            <span className="material-symbols-outlined text-5xl text-tertiary">lock</span>
            <h1 className="text-3xl md:text-4xl font-headline font-bold text-on-surface leading-tight tracking-tight">
              Access by <span className="text-primary italic">Invitation Only</span>
            </h1>
          </div>
        </header>

        <div className="glass-panel rounded-lg p-8 border border-outline-variant/10">
          <p className="text-secondary text-lg font-light leading-relaxed">
            Suzy AI is an exclusive experience for members of The Real Love Network.
          </p>
          <p className="text-secondary/70 text-sm mt-4 leading-relaxed">
            If you&apos;re a member and need access, please contact your coach or check your email for an invitation link.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/"
            className="inline-block w-full bg-surface-container-high hover:bg-surface-bright py-4 rounded-xl text-on-surface font-bold text-lg border border-outline-variant/20 transition-all duration-300 hover:scale-[1.02] active:scale-95"
          >
            ← Back to Login
          </Link>
        </div>
      </main>
    </div>
  );
}