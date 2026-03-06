import { Link } from 'react-router';
import { Github, Shield, FileText, Coffee } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800/50 mt-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 pb-20 md:pb-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          &copy; {new Date().getFullYear()} reps v{__APP_VERSION__}
        </span>
        <div className="flex items-center gap-3">
          <Link
            to="/how-it-works"
            className="hover:text-zinc-400 transition-colors"
          >
            How It Works
          </Link>
          <span className="text-zinc-700">|</span>
          <Link
            to="/blog"
            className="hover:text-zinc-400 transition-colors"
          >
            Blog
          </Link>
          <span className="text-zinc-700">|</span>
          <Link
            to="/privacy"
            className="hover:text-zinc-400 transition-colors flex items-center gap-1"
          >
            <Shield size={12} />
            Privacy
          </Link>
          <span className="text-zinc-700">|</span>
          <Link
            to="/terms"
            className="hover:text-zinc-400 transition-colors flex items-center gap-1"
          >
            <FileText size={12} />
            Terms
          </Link>
          <span className="text-zinc-700">|</span>
          <a
            href="https://github.com/crgeee/reps"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400 transition-colors"
            aria-label="GitHub"
          >
            <Github size={14} />
          </a>
          <span className="text-zinc-700">|</span>
          <a
            href="https://buymeacoffee.com/crgeee"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-500 transition-colors flex items-center gap-1"
          >
            <Coffee size={12} />
            Buy Me a Coffee
          </a>
        </div>
      </div>
    </footer>
  );
}
