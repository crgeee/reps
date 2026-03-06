import { Link } from 'react-router';
import { Calendar } from 'lucide-react';
import { blogPosts } from '../data/blog-posts';

export default function Blog() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-lg font-bold tracking-tight text-zinc-100">Blog</h1>

      <div className="space-y-4">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-colors"
          >
            <h2 className="text-sm font-semibold text-zinc-100 mb-1">{post.title}</h2>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2">
              <Calendar size={12} />
              <time dateTime={post.date}>{post.date}</time>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">{post.summary}</p>
            <span className="inline-block mt-3 text-xs text-amber-500 hover:text-amber-400 transition-colors">
              Read more &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
