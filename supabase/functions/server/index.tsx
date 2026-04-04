import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Helper function to remove accents from string
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Helper function to generate email from name
function generateEmail(firstName: string, lastName: string): string {
  const cleanFirstName = removeAccents(firstName.toLowerCase().trim());
  const cleanLastName = removeAccents(lastName.toLowerCase().trim().replace(/\s+/g, ''));
  return `${cleanFirstName}.${cleanLastName}@nexus.local`;
}

// Create Supabase clients
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

/**
 * Decode and verify a Supabase user JWT locally.
 *
 * The Supabase Edge Function gateway validates the JWT *signature* before the
 * request reaches this Hono server, so inside the function we only need to
 * extract the payload — no extra HTTP round-trip to the auth server needed.
 *
 * Returns { id: string } on success, null if the token is absent, malformed,
 * expired, or belongs to an anonymous/service-role caller.
 */
function verifyUserToken(token: string | undefined): { id: string } | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // JWT payload is base64url-encoded; atob handles base64 after padding
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    // Must be an authenticated user, not the anon/service-role key
    if (payload.role !== 'authenticated' || !payload.sub) return null;
    // Reject expired tokens
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: payload.sub as string };
  } catch {
    return null;
  }
}

/**
 * Extract the user JWT from the request.
 * Prefer the X-User-Token header (sent alongside the anon-key Authorization header
 * so the Supabase gateway never rejects it). Fall back to the Authorization Bearer
 * token for backwards compatibility.
 */
function getUserToken(c: any): string | undefined {
  return c.req.header('X-User-Token') || c.req.header('Authorization')?.split(' ')[1];
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Custom error handler — always return { error } so the frontend can read it
app.onError((err, c) => {
  console.error(`Unhandled error: ${err}`);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

// Custom 404 handler — return { error } instead of Hono's default { message }
app.notFound((c) => {
  return c.json({ error: `Route not found: ${c.req.method} ${c.req.path}` }, 404);
});

// Initialize storage bucket — public so every user can see every image
async function initializeStorage() {
  const bucketName = 'make-e9524f09-nexus-media';
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const existing = buckets?.find(b => b.name === bucketName);
    if (!existing) {
      await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
      });
      console.log(`Created public storage bucket: ${bucketName}`);
    } else if (!existing.public) {
      // Migrate existing private bucket to public
      await supabaseAdmin.storage.updateBucket(bucketName, { public: true });
      console.log(`Migrated bucket ${bucketName} to public`);
    }
  } catch (error) {
    console.error(`Error initializing storage bucket: ${error}`);
  }
}

// Initialize on startup
initializeStorage();

// Health check endpoint
app.get("/make-server-e9524f09/health", (c) => {
  return c.json({ status: "ok" });
});

// Seed initial users endpoint (for development)
app.post("/make-server-e9524f09/seed-users", async (c) => {
  try {
    const seedUsers = [
      { name: "Victor Altiery Vieira Barros", cpf: "06446653352" },
      { name: "Luís Felipe Ferreira Cavalcante", cpf: "09027334358" },
      { name: "Robson Kauã Linhares Gomes", cpf: "09538288327" },
      { name: "Marcos Roberto Torres Filho", cpf: "05275162367" },
      { name: "João Cleber Rocha Sampaio", cpf: "03630575366" },
      { name: "Jebson Rene do Nascimento Sales", cpf: "50183087372" },
      { name: "Guilherme Barroso Torres Rocha", cpf: "06475578355" },
      { name: "Jose Renato de Lima Filho", cpf: "07642319363" },
      { name: "Mikael Araujo Silva", cpf: "07279331327" },
      { name: "Paulo Vitor da Silva Maia", cpf: "09292746367" },
      { name: "Francisco Klayton Barroso de Lima", cpf: "62794768395" },
      { name: "Raniere Paulino de Medeiros", cpf: "24549770368" },
      { name: "João Herbert de Oliveira Sá", cpf: "07526901329" },
      { name: "Rondiney Lourenço Da Costa", cpf: "08454360310" },
      { name: "Maria Renata Vieira Camargo", cpf: "62319959335" },
      { name: "Nicolas Andrade Barboza", cpf: "10829678310" },
      { name: "Ana Karolina Oliveira Moreira", cpf: "07983510390" },
      { name: "Tiago Xavier da Silva", cpf: "04013678357" },
      { name: "Guilherme Alves Marques", cpf: "67184294300" },
      { name: "Tayson Dos Santos Oliveira", cpf: "62293884309" },
      { name: "Gleydson Da Silva Marques", cpf: "06491879380" },
      { name: "Victor Gabriel Ferreira de Paula", cpf: "62862621307" },
      { name: "Alan Matos Paixão", cpf: "08044680365" },
      { name: "Rian Victor Lourenço Silva", cpf: "09666186373" },
      { name: "Filipe Bruno Viana Cordeiro", cpf: "08183971369" },
      { name: "Brenda Kesia Pereira Lima Viana", cpf: "05083092395" },
      { name: "Karina Maria Barbosa da Silva", cpf: "08750448323" },
      { name: "Mara De Sousa Almeida", cpf: "61812060351" },
      { name: "Cleanderson Pereira Batista", cpf: "60548743304" },
      { name: "Francisco Edson Rabelo da Silva", cpf: "62689525372" },
      // Legacy test users kept for compatibility
      { name: "João Silva", cpf: "12345678900" },
      { name: "Maria Santos", cpf: "98765432100" },
    ];

    const results = [];

    // Fetch existing users ONCE to avoid calling listUsers() 32 times
    let existingEmails = new Set<string>();
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      existingEmails = new Set(existingUsers.users.map((u: any) => u.email));
    } catch (listError) {
      console.error(`Error fetching existing users list: ${listError}`);
    }

    for (const seedUser of seedUsers) {
      const nameParts = seedUser.name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      const email = generateEmail(firstName, lastName);
      const password = seedUser.cpf;

      console.log(`Processing user: ${seedUser.name}, email: ${email}`);

      // Check against the cached list
      if (existingEmails.has(email)) {
        console.log(`User ${email} already exists, skipping.`);
        results.push({ name: seedUser.name, status: 'already_exists', email });
        continue;
      }

      // Create user with Supabase Auth
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        user_metadata: { 
          firstName,
          lastName,
          cpf: seedUser.cpf,
          displayName: seedUser.name,
        },
        email_confirm: true
      });

      if (error) {
        console.error(`Error creating user ${seedUser.name}: ${error.message}`);
        results.push({ name: seedUser.name, status: 'error', error: error.message, email });
        continue;
      }

      console.log(`Successfully created user ${seedUser.name} with ID: ${data.user.id}`);

      // Create user profile in KV store
      await kv.set(`user:${data.user.id}`, {
        id: data.user.id,
        firstName,
        lastName,
        cpf: seedUser.cpf,
        displayName: seedUser.name,
        bio: '',
        avatar: '',
        banner: '',
        createdAt: new Date().toISOString(),
      });

      results.push({ name: seedUser.name, status: 'created', userId: data.user.id, email });
    }

    return c.json({ 
      success: true,
      message: 'Seed completed',
      results 
    });
  } catch (error) {
    console.error(`Unexpected error during seeding: ${error}`);
    return c.json({ error: 'Internal server error during seeding' }, 500);
  }
});

// ============ AUTH ENDPOINTS ============

// Sign up endpoint
app.post("/make-server-e9524f09/auth/signup", async (c) => {
  try {
    const { firstName, lastName, cpf } = await c.req.json();
    
    if (!firstName || !lastName || !cpf) {
      return c.json({ error: 'First name, last name and CPF are required' }, 400);
    }

    const email = generateEmail(firstName, lastName);
    const password = cpf;

    // Create user with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        firstName,
        lastName,
        cpf,
        displayName: `${firstName} ${lastName}`,
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error(`Error creating user during signup: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Create user profile in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      firstName,
      lastName,
      cpf,
      displayName: `${firstName} ${lastName}`,
      bio: '',
      avatar: '',
      banner: '',
      createdAt: new Date().toISOString(),
    });

    return c.json({ 
      success: true, 
      user: data.user,
      email 
    });
  } catch (error) {
    console.error(`Unexpected error during signup: ${error}`);
    return c.json({ error: 'Internal server error during signup' }, 500);
  }
});

// Sign in endpoint
app.post("/make-server-e9524f09/auth/signin", async (c) => {
  try {
    const { firstName, lastName, cpf } = await c.req.json();
    
    if (!firstName || !lastName || !cpf) {
      return c.json({ error: 'First name, last name and CPF are required' }, 400);
    }

    const email = generateEmail(firstName, lastName);
    const password = cpf;

    console.log(`Attempting login for email: ${email}, password: ${password}`);

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error(`Error signing in user with email ${email}: ${error.message}`);
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    return c.json({ 
      success: true, 
      session: data.session,
      user: data.user 
    });
  } catch (error) {
    console.error(`Unexpected error during signin: ${error}`);
    return c.json({ error: 'Internal server error during signin' }, 500);
  }
});

// Get current session
app.get("/make-server-e9524f09/auth/session", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const { data, error } = await supabaseClient.auth.getUser(accessToken);

    if (error || !data.user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.error(`Error getting session: ${error}`);
    return c.json({ error: 'Internal server error getting session' }, 500);
  }
});

// ============ USER PROFILE ENDPOINTS ============

// Get user profile
app.get("/make-server-e9524f09/users/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    let profile = await kv.get(`user:${userId}`);

    // Auto-create profile from Auth metadata if it doesn't exist in KV
    if (!profile) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authError || !authUser?.user) {
          console.error(`User ${userId} not found in Auth: ${authError?.message}`);
          return c.json({ error: 'User not found' }, 404);
        }
        const meta = authUser.user.user_metadata || {};
        const firstName = meta.firstName || authUser.user.email?.split('.')[0] || 'Usuário';
        const lastName = meta.lastName || authUser.user.email?.split('.')[1]?.replace('@nexus.local','') || '';
        const displayName = meta.displayName || `${firstName} ${lastName}`.trim();
        profile = {
          id: userId,
          firstName,
          lastName,
          cpf: meta.cpf || '',
          displayName,
          bio: meta.bio || '',
          avatar: '',
          banner: '',
          createdAt: authUser.user.created_at || new Date().toISOString(),
        };
        await kv.set(`user:${userId}`, profile);
        console.log(`Auto-created KV profile for user ${userId}: ${displayName}`);
      } catch (autoCreateError) {
        console.error(`Error auto-creating profile for ${userId}: ${autoCreateError}`);
        return c.json({ error: 'User not found' }, 404);
      }
    }

    return c.json(profile);
  } catch (error) {
    console.error(`Error getting user profile: ${error}`);
    return c.json({ error: 'Internal server error getting profile' }, 500);
  }
});

// Update user profile
app.put("/make-server-e9524f09/users/:userId", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('userId');
    
    if (user.id !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const updates = await c.req.json();
    const currentProfile = await kv.get(`user:${userId}`);
    
    if (!currentProfile) {
      return c.json({ error: 'User not found' }, 404);
    }

    const updatedProfile = {
      ...currentProfile,
      ...updates,
      id: userId, // Prevent ID change
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`user:${userId}`, updatedProfile);

    return c.json(updatedProfile);
  } catch (error) {
    console.error(`Error updating user profile: ${error}`);
    return c.json({ error: 'Internal server error updating profile' }, 500);
  }
});

// ============ POSTS ENDPOINTS ============

// Create post
app.post("/make-server-e9524f09/posts", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    
    if (!user) {
      return c.json({ error: 'Unauthorized - please sign in' }, 401);
    }

    const { content, mediaUrls, mediaType, isRepost, originalPostId, quotedPostId, embedUrl, embedType, poll } = await c.req.json();

    if (!content && !mediaUrls?.length && !isRepost && !quotedPostId && !embedUrl && !poll) {
      return c.json({ error: 'Post must have content, media, or be a repost' }, 400);
    }

    const postId = crypto.randomUUID();

    // Process poll options with ids if present
    const processedPoll = poll ? {
      options: poll.options.map((opt: any) => ({
        id: crypto.randomUUID(),
        text: opt.text,
        votes: [],
      })),
      endsAt: poll.endsAt || null,
    } : null;

    const post = {
      id: postId,
      userId: user.id,
      content: content || '',
      mediaUrls: mediaUrls || [],
      mediaType: mediaType || null,
      isRepost: isRepost || false,
      originalPostId: originalPostId || null,
      quotedPostId: quotedPostId || null,
      embedUrl: embedUrl || null,
      embedType: embedType || null,
      poll: processedPoll,
      likes: [],
      reposts: [],
      comments: [],
      createdAt: new Date().toISOString(),
    };

    await kv.set(`post:${postId}`, post);

    // Add to user's posts list
    const userPosts = await kv.get(`user_posts:${user.id}`) || [];
    userPosts.unshift(postId);
    await kv.set(`user_posts:${user.id}`, userPosts);

    // Add to global feed
    const globalFeed = await kv.get('global_feed') || [];
    globalFeed.unshift(postId);
    // Keep only last 500 posts in feed
    if (globalFeed.length > 500) {
      globalFeed.splice(500);
    }
    await kv.set('global_feed', globalFeed);

    // Notify the quoted post author
    if (quotedPostId) {
      const quotedPost = await kv.get(`post:${quotedPostId}`);
      if (quotedPost && quotedPost.userId !== user.id) {
        const fromProfile = await kv.get(`user:${user.id}`);
        const notification = {
          id: crypto.randomUUID(),
          type: 'quote',
          fromUserId: user.id,
          fromUserName: fromProfile?.displayName || 'Alguém',
          fromUserAvatar: fromProfile?.avatar || '',
          postId: quotedPostId,
          postContent: content?.substring(0, 60) || '',
          read: false,
          createdAt: new Date().toISOString(),
        };
        const notifs = await kv.get(`notifications:${quotedPost.userId}`) || [];
        notifs.unshift(notification);
        if (notifs.length > 100) notifs.splice(100);
        await kv.set(`notifications:${quotedPost.userId}`, notifs);
      }
    }

    return c.json(post);
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json({ error: 'Internal server error creating post' }, 500);
  }
});

// Get feed
app.get("/make-server-e9524f09/posts/feed", async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const globalFeed = await kv.get('global_feed') || [];
    const postIds = globalFeed.slice(offset, offset + limit);
    
    const posts = await Promise.all(
      postIds.map(async (postId: string) => {
        const post = await kv.get(`post:${postId}`);
        if (!post) return null;
        
        const userProfile = await kv.get(`user:${post.userId}`);

        let quotedPost = null;
        if (post.quotedPostId) {
          const qp = await kv.get(`post:${post.quotedPostId}`);
          if (qp) {
            const qpAuthor = await kv.get(`user:${qp.userId}`);
            quotedPost = { ...qp, author: qpAuthor };
          }
        }

        return { ...post, author: userProfile, quotedPost };
      })
    );

    return c.json(posts.filter(p => p !== null));
  } catch (error) {
    console.error(`Error getting feed: ${error}`);
    return c.json({ error: 'Internal server error getting feed' }, 500);
  }
});

// Get user posts
app.get("/make-server-e9524f09/posts/user/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const userPosts = await kv.get(`user_posts:${userId}`) || [];
    
    const posts = await Promise.all(
      userPosts.map(async (postId: string) => {
        const post = await kv.get(`post:${postId}`);
        if (!post) return null;
        
        const userProfile = await kv.get(`user:${userId}`);

        let quotedPost = null;
        if (post.quotedPostId) {
          const qp = await kv.get(`post:${post.quotedPostId}`);
          if (qp) {
            const qpAuthor = await kv.get(`user:${qp.userId}`);
            quotedPost = { ...qp, author: qpAuthor };
          }
        }

        return { ...post, author: userProfile, quotedPost };
      })
    );

    return c.json(posts.filter(p => p !== null));
  } catch (error) {
    console.error(`Error getting user posts: ${error}`);
    return c.json({ error: 'Internal server error getting user posts' }, 500);
  }
});

// Get single post by ID
app.get("/make-server-e9524f09/posts/:postId", async (c) => {
  try {
    const postId = c.req.param('postId');
    const post = await kv.get(`post:${postId}`);

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    const userProfile = await kv.get(`user:${post.userId}`);

    let quotedPost = null;
    if (post.quotedPostId) {
      const qp = await kv.get(`post:${post.quotedPostId}`);
      if (qp) {
        const qpAuthor = await kv.get(`user:${qp.userId}`);
        quotedPost = { ...qp, author: qpAuthor };
      }
    }

    return c.json({ ...post, author: userProfile, quotedPost });
  } catch (error) {
    console.error(`Error getting post: ${error}`);
    return c.json({ error: 'Internal server error getting post' }, 500);
  }
});

// Delete post
app.delete("/make-server-e9524f09/posts/:postId", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const postId = c.req.param('postId');
    const post = await kv.get(`post:${postId}`);
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    if (post.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await kv.del(`post:${postId}`);

    // Remove from user posts
    const userPosts = await kv.get(`user_posts:${user.id}`) || [];
    const updatedUserPosts = userPosts.filter((id: string) => id !== postId);
    await kv.set(`user_posts:${user.id}`, updatedUserPosts);

    // Remove from global feed
    const globalFeed = await kv.get('global_feed') || [];
    const updatedFeed = globalFeed.filter((id: string) => id !== postId);
    await kv.set('global_feed', updatedFeed);

    return c.json({ success: true });
  } catch (error) {
    console.error(`Error deleting post: ${error}`);
    return c.json({ error: 'Internal server error deleting post' }, 500);
  }
});

// Like post
app.post("/make-server-e9524f09/posts/:postId/like", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const postId = c.req.param('postId');
    const post = await kv.get(`post:${postId}`);
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    const likes = post.likes || [];
    const hasLiked = likes.includes(user.id);

    if (hasLiked) {
      post.likes = likes.filter((id: string) => id !== user.id);
    } else {
      post.likes = [...likes, user.id];
      // Create like notification for the post author (not yourself)
      if (post.userId !== user.id) {
        const fromUserProfile = await kv.get(`user:${user.id}`);
        const notification = {
          id: crypto.randomUUID(),
          type: 'like',
          fromUserId: user.id,
          fromUserName: fromUserProfile?.displayName || 'Alguém',
          fromUserAvatar: fromUserProfile?.avatar || '',
          postId,
          postContent: post.content?.substring(0, 60) || '',
          read: false,
          createdAt: new Date().toISOString(),
        };
        const notifs = await kv.get(`notifications:${post.userId}`) || [];
        notifs.unshift(notification);
        if (notifs.length > 100) notifs.splice(100);
        await kv.set(`notifications:${post.userId}`, notifs);
      }
    }

    await kv.set(`post:${postId}`, post);

    return c.json({ liked: !hasLiked, likesCount: post.likes.length });
  } catch (error) {
    console.error(`Error liking post: ${error}`);
    return c.json({ error: 'Internal server error liking post' }, 500);
  }
});

// Repost endpoint (dedicated - updates reposts count on original)
app.post("/make-server-e9524f09/posts/:postId/repost", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const postId = c.req.param('postId');
    const originalPost = await kv.get(`post:${postId}`);

    if (!originalPost) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // Prevent self-reposting the same post twice
    const reposts = originalPost.reposts || [];
    if (reposts.includes(user.id)) {
      return c.json({ repostsCount: reposts.length, alreadyReposted: true });
    }

    // Update original post's reposts array
    originalPost.reposts = [...reposts, user.id];
    await kv.set(`post:${postId}`, originalPost);

    // Repost notification for the original author
    if (originalPost.userId !== user.id) {
      const fromUserProfile = await kv.get(`user:${user.id}`);
      const notification = {
        id: crypto.randomUUID(),
        type: 'repost',
        fromUserId: user.id,
        fromUserName: fromUserProfile?.displayName || 'Alguém',
        fromUserAvatar: fromUserProfile?.avatar || '',
        postId,
        postContent: originalPost.content?.substring(0, 60) || '',
        read: false,
        createdAt: new Date().toISOString(),
      };
      const notifs = await kv.get(`notifications:${originalPost.userId}`) || [];
      notifs.unshift(notification);
      if (notifs.length > 100) notifs.splice(100);
      await kv.set(`notifications:${originalPost.userId}`, notifs);
    }

    // Create repost entry
    const repostId = crypto.randomUUID();
    const repost = {
      id: repostId,
      userId: user.id,
      content: originalPost.content,
      mediaUrls: originalPost.mediaUrls || [],
      mediaType: originalPost.mediaType || null,
      isRepost: true,
      originalPostId: postId,
      likes: [],
      reposts: [],
      comments: [],
      createdAt: new Date().toISOString(),
    };

    await kv.set(`post:${repostId}`, repost);

    // Add to user's posts list
    const userPosts = await kv.get(`user_posts:${user.id}`) || [];
    userPosts.unshift(repostId);
    await kv.set(`user_posts:${user.id}`, userPosts);

    // Add to global feed
    const globalFeed = await kv.get('global_feed') || [];
    globalFeed.unshift(repostId);
    if (globalFeed.length > 500) globalFeed.splice(500);
    await kv.set('global_feed', globalFeed);

    return c.json({
      success: true,
      repostsCount: originalPost.reposts.length,
    });
  } catch (error) {
    console.error(`Error reposting: ${error}`);
    return c.json({ error: 'Internal server error during repost' }, 500);
  }
});

// Comment on post
app.post("/make-server-e9524f09/posts/:postId/comment", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const postId = c.req.param('postId');
    const post = await kv.get(`post:${postId}`);

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    const { content } = await c.req.json();

    if (!content || !content.trim()) {
      return c.json({ error: 'Comment content is required' }, 400);
    }

    const userProfile = await kv.get(`user:${user.id}`);

    const commentId = crypto.randomUUID();
    const comment = {
      id: commentId,
      userId: user.id,
      content: content.trim(),
      authorName: userProfile?.displayName || 'Usuário',
      authorAvatar: userProfile?.avatar || '',
      createdAt: new Date().toISOString(),
    };

    const comments = post.comments || [];
    comments.push(comment);
    post.comments = comments;

    await kv.set(`post:${postId}`, post);

    // Comment notification for the post author (not yourself)
    if (post.userId !== user.id) {
      const notification = {
        id: crypto.randomUUID(),
        type: 'comment',
        fromUserId: user.id,
        fromUserName: userProfile?.displayName || 'Alguém',
        fromUserAvatar: userProfile?.avatar || '',
        postId,
        postContent: content.trim().substring(0, 60),
        read: false,
        createdAt: new Date().toISOString(),
      };
      const notifs = await kv.get(`notifications:${post.userId}`) || [];
      notifs.unshift(notification);
      if (notifs.length > 100) notifs.splice(100);
      await kv.set(`notifications:${post.userId}`, notifs);
    }

    return c.json(comment);
  } catch (error) {
    console.error(`Error commenting on post: ${error}`);
    return c.json({ error: 'Internal server error during comment' }, 500);
  }
});

// ============ POLL VOTE ENDPOINT ============

app.post("/make-server-e9524f09/posts/:postId/vote", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const postId = c.req.param('postId');
    const { optionId } = await c.req.json();

    if (!optionId) return c.json({ error: 'optionId is required' }, 400);

    const post = await kv.get(`post:${postId}`);
    if (!post) return c.json({ error: 'Post not found' }, 404);
    if (!post.poll) return c.json({ error: 'Post has no poll' }, 400);

    // Remove user from any existing vote first
    const updatedOptions = post.poll.options.map((opt: any) => ({
      ...opt,
      votes: opt.votes.filter((v: string) => v !== user.id),
    }));

    // Add vote to selected option
    const finalOptions = updatedOptions.map((opt: any) => {
      if (opt.id === optionId) {
        return { ...opt, votes: [...opt.votes, user.id] };
      }
      return opt;
    });

    post.poll = { ...post.poll, options: finalOptions };
    await kv.set(`post:${postId}`, post);

    return c.json({ poll: post.poll });
  } catch (error) {
    console.error(`Error voting: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============ MEDIA UPLOAD ENDPOINT ============

const BUCKET_NAME = 'make-e9524f09-nexus-media';

// Ensure the storage bucket exists and is PUBLIC (called inline before every upload)
async function ensureBucket() {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) {
      console.error(`ensureBucket: failed to list buckets: ${listError.message}`);
      return;
    }
    const existing = buckets?.find(b => b.name === BUCKET_NAME);
    if (!existing) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 52428800, // 50 MB
      });
      if (createError) {
        console.error(`ensureBucket: failed to create bucket: ${createError.message}`);
      } else {
        console.log(`ensureBucket: created public bucket ${BUCKET_NAME}`);
      }
    } else if (!existing.public) {
      // Migrate existing private bucket to public
      await supabaseAdmin.storage.updateBucket(BUCKET_NAME, { public: true });
      console.log(`ensureBucket: migrated ${BUCKET_NAME} to public`);
    }
  } catch (err) {
    console.error(`ensureBucket: unexpected error: ${err}`);
  }
}

// Derive a safe MIME type from file extension when file.type is missing
function getMimeType(filename: string, originalType: string): string {
  if (originalType && originalType !== 'application/octet-stream') return originalType;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  };
  return map[ext] ?? 'application/octet-stream';
}

/**
 * Step 1 of 2: the client requests a signed upload URL.
 * The server validates the user, creates the URL, and returns it.
 * No file data is transferred through the edge function — zero memory pressure.
 */
app.post("/make-server-e9524f09/upload/sign", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) {
      return c.json({ error: 'Unauthorized: invalid or expired token' }, 401);
    }

    const { filename, contentType: rawContentType, fileSize } = await c.req.json();

    if (!filename) {
      return c.json({ error: 'filename is required' }, 400);
    }

    // Enforce a 50 MB hard limit
    const MAX_BYTES = 50 * 1024 * 1024;
    if (fileSize && fileSize > MAX_BYTES) {
      return c.json({ error: 'File too large (max 50 MB)' }, 400);
    }

    await ensureBucket();

    const nameParts = filename.split('.');
    const fileExt = nameParts.length > 1 ? nameParts.pop()!.toLowerCase() : 'bin';
    const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
    const contentType = getMimeType(filename, rawContentType || '');

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error(`upload/sign: createSignedUploadUrl error: ${error.message}`);
      return c.json({ error: `Failed to create upload URL: ${error.message}` }, 500);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    console.log(`upload/sign: user=${user.id}, path=${filePath}, contentType=${contentType}`);

    return c.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: filePath,
      publicUrl: publicUrlData.publicUrl,
      contentType,
    });
  } catch (error) {
    console.error(`upload/sign: unexpected error: ${error}`);
    return c.json({ error: `Internal server error: ${error}` }, 500);
  }
});

// Keep old /upload endpoint as a small-file fallback (≤ 1 MB) to avoid breaking anything
app.post("/make-server-e9524f09/upload", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) {
      return c.json({ error: 'Unauthorized: invalid or expired token' }, 401);
    }

    await ensureBucket();

    let body: { filename: string; contentType: string; data: string };
    try {
      body = await c.req.json();
    } catch (parseErr) {
      return c.json({ error: `Failed to parse request body: ${parseErr}` }, 400);
    }

    const { filename, contentType: rawContentType, data: base64Data } = body;

    if (!filename || !base64Data) {
      return c.json({ error: 'filename and data are required' }, 400);
    }

    // Hard cap: reject anything over 1 MB sent as base64 to protect memory
    if (base64Data.length > 1.4 * 1024 * 1024) {
      return c.json({
        error: 'File too large for direct upload. Use the /upload/sign endpoint instead.',
      }, 413);
    }

    let binaryData: Uint8Array;
    try {
      const binaryString = atob(base64Data);
      binaryData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        binaryData[i] = binaryString.charCodeAt(i);
      }
    } catch (decodeErr) {
      return c.json({ error: `Failed to decode file data: ${decodeErr}` }, 400);
    }

    const nameParts = filename.split('.');
    const fileExt = nameParts.length > 1 ? nameParts.pop()!.toLowerCase() : 'bin';
    const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
    const contentType = getMimeType(filename, rawContentType || '');

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, binaryData, { contentType, upsert: true });

    if (uploadError) {
      return c.json({ error: `Storage upload failed: ${uploadError.message}` }, 500);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return c.json({ url: publicUrlData.publicUrl, path: fileName });
  } catch (error) {
    console.error(`Upload: unexpected error: ${error}`);
    return c.json({ error: `Internal server error during upload: ${error}` }, 500);
  }
});

// ============ FOLLOWERS / FOLLOWING ENDPOINTS ============

// Get all users (for suggestions / search)
app.get("/make-server-e9524f09/users", async (c) => {
  try {
    const { data: authData, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      console.error(`Error listing users: ${error.message}`);
      return c.json({ error: 'Failed to list users' }, 500);
    }
    const users = await Promise.all(
      authData.users.map(async (u: any) => {
        const profile = await kv.get(`user:${u.id}`);
        return profile || {
          id: u.id,
          displayName: u.user_metadata?.displayName || u.email?.split('@')[0] || 'Usuário',
          firstName: u.user_metadata?.firstName || '',
          lastName: u.user_metadata?.lastName || '',
          avatar: '',
          banner: '',
          bio: '',
        };
      })
    );
    return c.json(users.filter(Boolean));
  } catch (error) {
    console.error(`Error getting all users: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Follow / unfollow a user
app.post("/make-server-e9524f09/users/:userId/follow", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const targetUserId = c.req.param('userId');
    if (user.id === targetUserId) return c.json({ error: 'Cannot follow yourself' }, 400);

    const following = await kv.get(`following:${user.id}`) || [];
    const isFollowing = following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      await kv.set(`following:${user.id}`, following.filter((id: string) => id !== targetUserId));
      const followers = await kv.get(`followers:${targetUserId}`) || [];
      const newFollowers = followers.filter((id: string) => id !== user.id);
      await kv.set(`followers:${targetUserId}`, newFollowers);
      return c.json({ following: false, followersCount: newFollowers.length });
    } else {
      // Follow
      const newFollowing = [...following, targetUserId];
      await kv.set(`following:${user.id}`, newFollowing);
      const followers = await kv.get(`followers:${targetUserId}`) || [];
      const newFollowers = [...followers, user.id];
      await kv.set(`followers:${targetUserId}`, newFollowers);

      // Follow notification
      const fromUserProfile = await kv.get(`user:${user.id}`);
      const notification = {
        id: crypto.randomUUID(),
        type: 'follow',
        fromUserId: user.id,
        fromUserName: fromUserProfile?.displayName || 'Alguém',
        fromUserAvatar: fromUserProfile?.avatar || '',
        read: false,
        createdAt: new Date().toISOString(),
      };
      const notifs = await kv.get(`notifications:${targetUserId}`) || [];
      notifs.unshift(notification);
      if (notifs.length > 100) notifs.splice(100);
      await kv.set(`notifications:${targetUserId}`, notifs);

      return c.json({ following: true, followersCount: newFollowers.length });
    }
  } catch (error) {
    console.error(`Error follow/unfollow: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user followers
app.get("/make-server-e9524f09/users/:userId/followers", async (c) => {
  try {
    const userId = c.req.param('userId');
    const followers = await kv.get(`followers:${userId}`) || [];
    return c.json({ followers, count: followers.length });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user following list
app.get("/make-server-e9524f09/users/:userId/following", async (c) => {
  try {
    const userId = c.req.param('userId');
    const following = await kv.get(`following:${userId}`) || [];
    return c.json({ following, count: following.length });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============ NOTIFICATIONS ENDPOINTS ============

// Get notifications for current user
app.get("/make-server-e9524f09/notifications", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const notifications = await kv.get(`notifications:${user.id}`) || [];
    return c.json(notifications);
  } catch (error) {
    console.error(`Error getting notifications: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mark all notifications as read
app.post("/make-server-e9524f09/notifications/read", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const notifications = await kv.get(`notifications:${user.id}`) || [];
    const updated = notifications.map((n: any) => ({ ...n, read: true }));
    await kv.set(`notifications:${user.id}`, updated);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Unread notifications count
app.get("/make-server-e9524f09/notifications/unread-count", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const notifications = await kv.get(`notifications:${user.id}`) || [];
    const count = notifications.filter((n: any) => !n.read).length;
    return c.json({ count });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============ DIRECT MESSAGES ENDPOINTS ============

function getConversationKey(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `dm:${sorted[0]}:${sorted[1]}`;
}

// List all conversations for current user
app.get("/make-server-e9524f09/dm/conversations", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const partnerIds: string[] = await kv.get(`conversations:${user.id}`) || [];
    const conversations = await Promise.all(
      partnerIds.map(async (partnerId: string) => {
        const convKey = getConversationKey(user.id, partnerId);
        const messages: any[] = await kv.get(convKey) || [];
        const lastMessage = messages[messages.length - 1] || null;
        const partnerProfile = await kv.get(`user:${partnerId}`);
        const unreadCount = messages.filter((m: any) => m.fromUserId !== user.id && !m.read).length;
        return { partnerId, partnerProfile, lastMessage, unreadCount };
      })
    );

    // Sort by last message time descending
    conversations.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });

    return c.json(conversations);
  } catch (error) {
    console.error(`Error getting conversations: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get messages in a conversation
app.get("/make-server-e9524f09/dm/:partnerId/messages", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const partnerId = c.req.param('partnerId');
    const convKey = getConversationKey(user.id, partnerId);
    const messages: any[] = await kv.get(convKey) || [];

    // Mark partner's messages as read
    const updated = messages.map((m: any) =>
      m.fromUserId === partnerId ? { ...m, read: true } : m
    );
    await kv.set(convKey, updated);

    return c.json(updated);
  } catch (error) {
    console.error(`Error getting messages: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Send a message
app.post("/make-server-e9524f09/dm/:partnerId/messages", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const partnerId = c.req.param('partnerId');
    const { content } = await c.req.json();
    if (!content?.trim()) return c.json({ error: 'Message content is required' }, 400);

    const convKey = getConversationKey(user.id, partnerId);
    const messages: any[] = await kv.get(convKey) || [];

    const message = {
      id: crypto.randomUUID(),
      fromUserId: user.id,
      content: content.trim(),
      read: false,
      createdAt: new Date().toISOString(),
    };

    messages.push(message);
    if (messages.length > 500) messages.splice(0, messages.length - 500);
    await kv.set(convKey, messages);

    // Ensure both users have each other in their conversation lists
    const userConvs: string[] = await kv.get(`conversations:${user.id}`) || [];
    if (!userConvs.includes(partnerId)) {
      userConvs.unshift(partnerId);
      await kv.set(`conversations:${user.id}`, userConvs);
    }
    const partnerConvs: string[] = await kv.get(`conversations:${partnerId}`) || [];
    if (!partnerConvs.includes(user.id)) {
      partnerConvs.unshift(user.id);
      await kv.set(`conversations:${partnerId}`, partnerConvs);
    }

    // Message notification for the partner
    const fromProfile = await kv.get(`user:${user.id}`);
    const notification = {
      id: crypto.randomUUID(),
      type: 'message',
      fromUserId: user.id,
      fromUserName: fromProfile?.displayName || 'Alguém',
      fromUserAvatar: fromProfile?.avatar || '',
      content: content.trim().substring(0, 60),
      read: false,
      createdAt: new Date().toISOString(),
    };
    const partnerNotifs: any[] = await kv.get(`notifications:${partnerId}`) || [];
    partnerNotifs.unshift(notification);
    if (partnerNotifs.length > 100) partnerNotifs.splice(100);
    await kv.set(`notifications:${partnerId}`, partnerNotifs);

    return c.json(message);
  } catch (error) {
    console.error(`Error sending message: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============ TRENDING TOPICS ENDPOINT ============

app.get("/make-server-e9524f09/posts/trending", async (c) => {
  try {
    const globalFeed: string[] = await kv.get('global_feed') || [];
    const recentIds = globalFeed.slice(0, 200);

    const posts = await Promise.all(recentIds.map((id: string) => kv.get(`post:${id}`)));

    const stopWords = new Set([
      'para', 'com', 'uma', 'que', 'não', 'mais', 'como', 'isso', 'este', 'esta',
      'esse', 'essa', 'pelo', 'pela', 'pelos', 'pelas', 'numa', 'num', 'mas', 'por',
      'sem', 'sobre', 'entre', 'todo', 'toda', 'todos', 'todas', 'muito', 'muita',
      'muitos', 'muitas', 'bem', 'também', 'ainda', 'aqui', 'isto', 'aquilo', 'onde',
      'quando', 'quem', 'qual', 'quais', 'ser', 'estar', 'ter', 'fazer', 'pode',
      'vai', 'vou', 'vem', 'são', 'seus', 'suas', 'seu', 'sua', 'nos', 'nas', 'aos',
      'das', 'dos', 'foi', 'tem', 'era', 'ele', 'ela', 'eles', 'elas', 'você',
      'voce', 'então', 'entao', 'tudo', 'nada', 'hoje', 'aqui', 'pelo', 'está',
      'estou', 'essa', 'esse', 'isso', 'numa', 'dele', 'dela', 'deles', 'delas',
    ]);

    const wordData: Record<string, { count: number; users: Set<string> }> = {};

    for (const post of posts.filter(Boolean)) {
      if (!post.content) continue;
      const words = post.content
        .toLowerCase()
        .replace(/[^a-záéíóúãõâêîôûàèìòùç\s]/g, ' ')
        .split(/\s+/)
        .filter((w: string) => w.length >= 4 && !stopWords.has(w));

      for (const word of words) {
        if (!wordData[word]) wordData[word] = { count: 0, users: new Set() };
        wordData[word].count++;
        wordData[word].users.add(post.userId);
      }
    }

    const trending = Object.entries(wordData)
      .filter(([_, d]) => d.count >= 1)
      .sort((a, b) => b[1].count - a[1].count || b[1].users.size - a[1].users.size)
      .slice(0, 5)
      .map(([word, d]) => ({
        topic: word.charAt(0).toUpperCase() + word.slice(1),
        count: d.count,
        userCount: d.users.size,
      }));

    return c.json(trending);
  } catch (error) {
    console.error(`Error getting trending: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============ NOTES ENDPOINTS ============

// Get all notes
app.get("/make-server-e9524f09/notes", async (c) => {
  try {
    const activeNotes: string[] = await kv.get('active_notes') || [];
    const notes = await Promise.all(
      activeNotes.map(async (userId: string) => {
        const note = await kv.get(`note:${userId}`);
        if (!note) return null;
        const profile = await kv.get(`user:${userId}`);
        return { ...note, author: profile };
      })
    );
    // Sort by createdAt desc
    const sorted = notes.filter(Boolean).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json(sorted);
  } catch (error) {
    console.error(`Error getting notes: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create or update own note
app.post("/make-server-e9524f09/notes", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { content, emoji } = await c.req.json();
    if (!content?.trim() && !emoji) {
      return c.json({ error: 'Note must have content or emoji' }, 400);
    }

    const note = {
      userId: user.id,
      content: content?.trim() || '',
      emoji: emoji || '',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`note:${user.id}`, note);

    const activeNotes: string[] = await kv.get('active_notes') || [];
    if (!activeNotes.includes(user.id)) {
      activeNotes.unshift(user.id);
      await kv.set('active_notes', activeNotes);
    } else {
      // Move to front
      const without = activeNotes.filter((id: string) => id !== user.id);
      await kv.set('active_notes', [user.id, ...without]);
    }

    const profile = await kv.get(`user:${user.id}`);
    return c.json({ ...note, author: profile });
  } catch (error) {
    console.error(`Error creating note: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete own note
app.delete("/make-server-e9524f09/notes", async (c) => {
  try {
    const user = verifyUserToken(getUserToken(c));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    await kv.del(`note:${user.id}`);
    const activeNotes: string[] = await kv.get('active_notes') || [];
    await kv.set('active_notes', activeNotes.filter((id: string) => id !== user.id));

    return c.json({ success: true });
  } catch (error) {
    console.error(`Error deleting note: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

Deno.serve(app.fetch);