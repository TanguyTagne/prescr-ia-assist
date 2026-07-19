import { Link } from "react-router-dom";
import { Clock, Calendar } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDate, type BlogPost } from "@/lib/blog";

interface Props { post: BlogPost; eager?: boolean }

const PostCard = ({ post, eager }: Props) => {
  const { lp, lang } = useI18n();
  return (
    <Link
      to={lp(`/blog/${post.slug}`)}
      className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
    >
      {post.image ? (
        <div className="aspect-[16/9] overflow-hidden bg-muted">
          <img
            src={post.image}
            alt={post.title}
            width={640}
            height={360}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-gradient-to-br from-primary/10 to-accent/10" />
      )}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <span className="inline-flex w-fit items-center rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5">
          {post.category}
        </span>
        <h2 className="text-lg font-semibold leading-snug tracking-tight group-hover:text-primary transition-colors">
          {post.title}
        </h2>
        <p className="text-sm text-muted-foreground line-clamp-3">{post.description}</p>
        <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground pt-2">
          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(post.date, lang)}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{post.readingTime} min</span>
        </div>
      </div>
    </Link>
  );
};

export default PostCard;
