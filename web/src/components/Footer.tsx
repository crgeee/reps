import { Github, Shield, FileText, Coffee } from 'lucide-react';

interface FooterProps {
  onNavigate?: (view: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  function handleLink(view: string) {
    if (onNavigate) {
      onNavigate(view);
    } else {
      window.location.hash = view;
    }
  }

  return (
    <footer className="border-t border-zinc-800/50 mt-12 pb-14">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 sm:pr-16 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-600">
        <span>&copy; {new Date().getFullYear()} reps</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleLink('privacy')}
            className="hover:text-zinc-400 transition-colors flex items-center gap-1"
          >
            <Shield size={12} />
            Privacy
          </button>
          <span className="text-zinc-800">|</span>
          <button
            onClick={() => handleLink('terms')}
            className="hover:text-zinc-400 transition-colors flex items-center gap-1"
          >
            <FileText size={12} />
            Terms
          </button>
          <span className="text-zinc-800">|</span>
          <a
            href="https://github.com/crgeee/reps"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400 transition-colors"
            aria-label="GitHub"
          >
            <Github size={14} />
          </a>
          <span className="text-zinc-800">|</span>
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
