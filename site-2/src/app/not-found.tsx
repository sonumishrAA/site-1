export const runtime = 'edge';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F1F5C] p-4 text-center">
      <h2 className="text-6xl font-black text-white mb-4">404</h2>
      <p className="text-xl text-white/70 mb-8">This page could not be found.</p>
      <Link 
        href="/" 
        className="px-6 py-3 bg-brand-500 hover:bg-brand-600 active:scale-95 transition-all text-white font-semibold rounded-xl"
      >
        Return Home
      </Link>
    </div>
  );
}
