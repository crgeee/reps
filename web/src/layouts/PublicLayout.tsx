import { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import Footer from '../components/Footer';

export default function PublicLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex-1">
        <Link
          to="/"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6 flex items-center gap-1"
        >
          &larr; Back
        </Link>
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
