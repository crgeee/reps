import { Link, useParams } from 'react-router';
import { Calendar } from 'lucide-react';
import { blogPosts } from '../data/blog-posts';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 text-center">
        <h1 className="text-lg font-bold text-zinc-100">Post not found</h1>
        <p className="text-sm text-zinc-400">The blog post you're looking for doesn't exist.</p>
        <Link
          to="/blog"
          className="inline-block text-sm text-amber-500 hover:text-amber-400 transition-colors"
        >
          &larr; Back to blog
        </Link>
      </div>
    );
  }

  const paragraphs = post.content.split('\n\n');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/blog"
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1"
      >
        &larr; Back to blog
      </Link>

      <div>
        <h1 className="text-lg font-bold tracking-tight text-zinc-100 mb-1">{post.title}</h1>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Calendar size={12} />
          <time dateTime={post.date}>{post.date}</time>
        </div>
      </div>

      <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
