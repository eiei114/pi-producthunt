export interface RateLimitInfo {
  limit?: string;
  remaining?: string;
  reset?: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor?: string | null;
}

export interface TopicSummary {
  id?: string;
  name: string;
  slug?: string;
}

export interface MakerSummary {
  id?: string;
  name: string;
  username?: string | null;
}

export interface PostListItem {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  url?: string | null;
  votesCount?: number | null;
  commentsCount?: number | null;
  featuredAt?: string | null;
  createdAt?: string | null;
  topics: TopicSummary[];
}

export interface PostDetails extends PostListItem {
  description?: string | null;
  website?: string | null;
  thumbnailUrl?: string | null;
  makers: MakerSummary[];
  user?: MakerSummary | null;
}

export interface CommentSummary {
  id: string;
  body: string;
  votesCount?: number | null;
  createdAt?: string | null;
  user?: MakerSummary | null;
  repliesCount?: number | null;
}

export interface PostConnectionResult {
  posts: PostListItem[];
  pageInfo?: PageInfo;
  totalCount?: number;
  rateLimit?: RateLimitInfo;
}

export interface PostCommentsResult {
  post: Pick<PostListItem, "id" | "name" | "slug">;
  comments: CommentSummary[];
  pageInfo?: PageInfo;
  totalCount?: number;
  rateLimit?: RateLimitInfo;
}

export interface ResearchTopicResult {
  query: string;
  posts: Array<PostListItem & { comments?: CommentSummary[] }>;
  rateLimit?: RateLimitInfo;
}

export interface WatchlistEntry {
  name: string;
  slug: string;
  whyPromising: string;
  launchTiming: string;
  nextUrl: string;
}

export interface ViewerResult {
  username?: string;
  rateLimit?: RateLimitInfo;
}

