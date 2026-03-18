

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 text-center">
      <h2 className="text-6xl font-black text-slate-800 mb-4">404</h2>
      <p className="text-xl text-slate-500 mb-8">This page could not be found.</p>
      <Link 
        href="/" 
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20"
      >
        Return Home
      </Link>
    </div>
  );
}
