import { executeProductHuntGraphQL } from "./api.ts";
import { dateRangeForDay, normalizePostIdentifier } from "./identity.ts";
import { postCommentsQuery, postDetailsQuery, postsQuery, searchPostsQuery, viewerQuery } from "./queries.ts";
import type {
  CommentSummary,
  MakerSummary,
  PostCommentsResult,
  PostConnectionResult,
  PostDetails,
  PostListItem,
  ResearchTopicResult,
  TopicSummary,
  ViewerResult,
} from "./types.ts";

type PostsOrder = "RANKING" | "NEWEST";
type CommentsOrder = "RANKING" | "NEWEST";

interface GraphQLEdge<T> {
  node: T;
}

interface GraphQLConnection<T> {
  edges: Array<GraphQLEdge<T>>;
  pageInfo?: { hasNextPage: boolean; endCursor?: string | null };
  totalCount?: number;
}

interface RawTopic {
  id?: string;
  name: string;
  slug?: string;
}

interface RawMaker {
  id?: string;
  name: string;
  username?: string | null;
}

interface RawPostListItem {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  url?: string | null;
  votesCount?: number | null;
  commentsCount?: number | null;
  featuredAt?: string | null;
  createdAt?: string | null;
  topics?: GraphQLConnection<RawTopic>;
}

interface RawPostDetails extends RawPostListItem {
  description?: string | null;
  website?: string | null;
  thumbnail?: { url?: string | null } | null;
  makers?: RawMaker[];
  user?: RawMaker | null;
}

interface RawComment {
  id: string;
  body: string;
  votesCount?: number | null;
  createdAt?: string | null;
  user?: RawMaker | null;
  replies?: { totalCount?: number | null } | null;
}

export interface ProductHuntClientOptions {
  signal?: AbortSignal;
  token?: string;
}

export async function getViewer(options: ProductHuntClientOptions = {}): Promise<ViewerResult> {
  const result = await executeProductHuntGraphQL<{ viewer?: { user?: { username?: string } | null } | null }>(
    viewerQuery,
    {},
    options,
  );
  return { username: result.data.viewer?.user?.username, rateLimit: result.rateLimit };
}

export async function getPosts(
  params: {
    date?: string;
    topic?: string;
    featured?: boolean;
    postedAfter?: string;
    postedBefore?: string;
    order?: PostsOrder;
    limit?: number;
    after?: string;
  },
  options: ProductHuntClientOptions = {},
): Promise<PostConnectionResult> {
  const range: { postedAfter?: string; postedBefore?: string } = params.date ? dateRangeForDay(params.date) : {};
  const first = clampLimit(params.limit, 10, 50);
  const result = await executeProductHuntGraphQL<{ posts: GraphQLConnection<RawPostListItem> }>(
    postsQuery,
    {
      featured: params.featured,
      topic: emptyToUndefined(params.topic),
      postedAfter: params.postedAfter ?? range.postedAfter,
      postedBefore: params.postedBefore ?? range.postedBefore,
      order: params.order ?? "RANKING",
      first,
      after: params.after,
    },
    options,
  );

  return {
    posts: result.data.posts.edges.map((edge) => cleanPostListItem(edge.node)),
    pageInfo: result.data.posts.pageInfo,
    totalCount: result.data.posts.totalCount,
    rateLimit: result.rateLimit,
  };
}

export async function searchPosts(
  params: { query: string; limit?: number; searchPool?: number; after?: string },
  options: ProductHuntClientOptions = {},
): Promise<PostConnectionResult> {
  const query = params.query.trim().toLowerCase();
  if (!query) throw new Error("Search query is required.");

  const searchPool = clampLimit(params.searchPool, 50, 100);
  const limit = clampLimit(params.limit, 10, 50);
  const result = await executeProductHuntGraphQL<{ posts: GraphQLConnection<RawPostListItem> }>(
    searchPostsQuery,
    { first: searchPool, after: params.after },
    options,
  );

  const filtered = result.data.posts.edges
    .map((edge) => cleanPostListItem(edge.node))
    .filter((post) => `${post.name} ${post.tagline ?? ""} ${post.topics.map((topic) => topic.name).join(" ")}`.toLowerCase().includes(query))
    .slice(0, limit);

  return {
    posts: filtered,
    pageInfo: result.data.posts.pageInfo,
    totalCount: filtered.length,
    rateLimit: result.rateLimit,
  };
}

export async function getPost(ref: string, options: ProductHuntClientOptions = {}): Promise<PostDetails> {
  const identifier = normalizePostIdentifier(ref);
  const result = await executeProductHuntGraphQL<{ post?: RawPostDetails | null }>(
    postDetailsQuery,
    { id: identifier.id, slug: identifier.slug },
    options,
  );
  if (!result.data.post) throw new Error("Product Hunt post not found.");
  return cleanPostDetails(result.data.post);
}

export async function getPostComments(
  params: { ref: string; limit?: number; order?: CommentsOrder; after?: string },
  options: ProductHuntClientOptions = {},
): Promise<PostCommentsResult> {
  const identifier = normalizePostIdentifier(params.ref);
  const result = await executeProductHuntGraphQL<{
    post?: { id: string; slug: string; name: string; comments: GraphQLConnection<RawComment> } | null;
  }>(
    postCommentsQuery,
    {
      postId: identifier.id,
      postSlug: identifier.slug,
      order: params.order ?? "RANKING",
      first: clampLimit(params.limit, 10, 50),
      after: params.after,
    },
    options,
  );

  if (!result.data.post) throw new Error("Product Hunt post not found.");

  return {
    post: { id: result.data.post.id, slug: result.data.post.slug, name: result.data.post.name },
    comments: result.data.post.comments.edges.map((edge) => cleanComment(edge.node)),
    pageInfo: result.data.post.comments.pageInfo,
    totalCount: result.data.post.comments.totalCount,
    rateLimit: result.rateLimit,
  };
}

export async function researchTopic(
  params: { query: string; limit?: number; commentsPerPost?: number },
  options: ProductHuntClientOptions = {},
): Promise<ResearchTopicResult> {
  const posts = await searchPosts({ query: params.query, limit: params.limit ?? 5, searchPool: 75 }, options);
  const commentsPerPost = clampLimit(params.commentsPerPost, 3, 10);
  const enriched: ResearchTopicResult["posts"] = [];

  for (const post of posts.posts) {
    try {
      const comments = await getPostComments({ ref: post.slug, limit: commentsPerPost }, options);
      enriched.push({ ...post, comments: comments.comments });
    } catch {
      enriched.push(post);
    }
  }

  return { query: params.query, posts: enriched, rateLimit: posts.rateLimit };
}

function cleanPostListItem(raw: RawPostListItem): PostListItem {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    tagline: raw.tagline,
    url: raw.url,
    votesCount: raw.votesCount,
    commentsCount: raw.commentsCount,
    featuredAt: raw.featuredAt,
    createdAt: raw.createdAt,
    topics: cleanTopics(raw.topics),
  };
}

function cleanPostDetails(raw: RawPostDetails): PostDetails {
  return {
    ...cleanPostListItem(raw),
    description: raw.description,
    website: raw.website,
    thumbnailUrl: raw.thumbnail?.url,
    makers: (raw.makers ?? []).map(cleanMaker),
    user: raw.user ? cleanMaker(raw.user) : null,
  };
}

function cleanComment(raw: RawComment): CommentSummary {
  return {
    id: raw.id,
    body: raw.body,
    votesCount: raw.votesCount,
    createdAt: raw.createdAt,
    user: raw.user ? cleanMaker(raw.user) : null,
    repliesCount: raw.replies?.totalCount,
  };
}

function cleanTopics(connection?: GraphQLConnection<RawTopic>): TopicSummary[] {
  return connection?.edges.map((edge) => edge.node).map((topic) => ({ id: topic.id, name: topic.name, slug: topic.slug })) ?? [];
}

function cleanMaker(raw: RawMaker): MakerSummary {
  return { id: raw.id, name: raw.name, username: raw.username };
}

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), max));
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

