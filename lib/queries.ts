export const viewerQuery = `
  query ProductHuntViewer {
    viewer { user { username } }
  }
`;

export const postsQuery = `
  query ProductHuntPosts(
    $featured: Boolean,
    $topic: String,
    $postedAfter: DateTime,
    $postedBefore: DateTime,
    $order: PostsOrder,
    $first: Int,
    $after: String
  ) {
    posts(
      featured: $featured,
      topic: $topic,
      postedAfter: $postedAfter,
      postedBefore: $postedBefore,
      order: $order,
      first: $first,
      after: $after
    ) {
      edges {
        node {
          id slug name tagline url votesCount commentsCount featuredAt createdAt
          topics { edges { node { id name slug } } }
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

export const searchPostsQuery = `
  query ProductHuntSearchPosts($first: Int, $after: String) {
    posts(order: RANKING, first: $first, after: $after) {
      edges {
        node {
          id slug name tagline url votesCount commentsCount featuredAt createdAt
          topics { edges { node { id name slug } } }
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

export const postDetailsQuery = `
  query ProductHuntPost($id: ID, $slug: String) {
    post(id: $id, slug: $slug) {
      id slug name tagline description url votesCount commentsCount reviewsRating featuredAt createdAt website
      thumbnail { url }
      topics { edges { node { id name slug } } }
      makers { id name username }
      user { id name username }
    }
  }
`;

export const postCommentsQuery = `
  query ProductHuntPostComments(
    $postId: ID,
    $postSlug: String,
    $order: CommentsOrder,
    $first: Int,
    $after: String
  ) {
    post(id: $postId, slug: $postSlug) {
      id slug name
      comments(order: $order, first: $first, after: $after) {
        edges {
          node {
            id body votesCount createdAt
            user { id name username }
            replies { totalCount }
          }
        }
        pageInfo { hasNextPage endCursor }
        totalCount
      }
    }
  }
`;

