'use client';

export const DISCLAIMER_COPY =
  "Coach Cass is educational relationship coaching — not a substitute for therapy, medical, or professional help. If you're in crisis, call or text 988.";

export default function DisclaimerBanner() {
  return (
    <div className="w-full px-6 md:px-12 lg:px-24 pt-24">
      <div className="max-w-5xl mx-auto">
        <div
          role="note"
          aria-label={DISCLAIMER_COPY}
          className="bg-[#4D1D57] text-white text-sm font-body leading-snug text-center px-4 py-2.5 rounded-lg border border-white/10"
        >
          {DISCLAIMER_COPY}
        </div>
      </div>
    </div>
  );
}
