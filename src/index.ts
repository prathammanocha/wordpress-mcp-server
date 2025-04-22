#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

// ================ INTERFACES ================

// Core WordPress Interfaces
interface WPPost {
  id: number;
  date?: string;
  date_gmt?: string;
  guid?: {
    rendered: string;
  };
  modified?: string;
  modified_gmt?: string;
  slug?: string;
  status?: 'publish' | 'future' | 'draft' | 'pending' | 'private';
  type?: string;
  link?: string;
  title?: {
    rendered: string;
  };
  content?: {
    rendered: string;
    protected?: boolean;
  };
  excerpt?: {
    rendered: string;
    protected?: boolean;
  };
  author?: number;
  featured_media?: number;
  comment_status?: 'open' | 'closed';
  ping_status?: 'open' | 'closed';
  sticky?: boolean;
  template?: string;
  format?: 'standard' | 'aside' | 'chat' | 'gallery' | 'link' | 'image' | 'quote' | 'status' | 'video' | 'audio';
  meta?: Record<string, any>;
  _links?: {
    self?: Array<{ href: string }>;
    collection?: Array<{ href: string }>;
    about?: Array<{ href: string }>;
    author?: Array<{ href: string; embeddable: boolean }>;
    replies?: Array<{ href: string; embeddable: boolean }>;
    'version-history'?: Array<{ href: string }>;
    'predecessor-version'?: Array<{ href: string; id: number }>;
    'wp:featuredmedia'?: Array<{ href: string; embeddable: boolean }>;
    'wp:attachment'?: Array<{ href: string }>;
    'wp:term'?: Array<{ href: string; taxonomy: string; embeddable: boolean }>;
    curies?: Array<{ name: string; href: string; templated: boolean }>;
  };
  categories?: number[];
  tags?: number[];
}

interface WPUser {
  id: number;
  name?: string;
  slug?: string;
  roles?: string[];
}

interface WPComment {
  id: number;
  author_name?: string;
  content?: {
    rendered: string;
  };
  post?: number;
  date?: string;
}

interface WPCategory {
  id: number;
  name?: string;
  slug?: string;
  description?: string;
  parent?: number;
  count?: number;
  meta?: Record<string, any>;
}

// Stats Related Interfaces
interface WPStatsHighlights {
  views: number;
  visitors: number;
  likes: number;
  comments: number;
  followers: number;
  posts: number;
  period: string;
}

interface WPStatsSummary {
  visitors: {
    total: number;
    fields: Array<{period: string; value: number}>;
  };
  views: {
    total: number;
    fields: Array<{period: string; value: number}>;
  };
  likes: {
    total: number;
    fields: Array<{period: string; value: number}>;
  };
  comments: {
    total: number;
    fields: Array<{period: string; value: number}>;
  };
}

interface WPTopPost {
  id: number;
  title: string;
  url: string;
  views: number;
  comment_count: number;
  likes: number;
}

interface WPReferrer {
  group: string;
  name: string;
  url: string;
  views: number;
  is_spam?: boolean;
}

interface WPCountryView {
  country_code: string;
  country_name: string;
  views: number;
  views_percent: number;
}

interface WPPostStatsData {
  period: string;
  views: number;
}

// ================ SERVER SETUP ================

// Create server instance
const server = new McpServer({
  name: "wordpress",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Helper function for making WordPress API requests
async function makeWPRequest<T>({
  siteUrl, 
  endpoint,
  method = 'GET',
  auth,
  data = null,
  params = null
}: {
  siteUrl: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  auth: { username: string; password: string };
  data?: any;
  params?: any;
}): Promise<T> {
  const authString = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  
  try {
    const response = await axios({
      method,
      url: `${siteUrl}/wp-json/wp/v2/${endpoint}`,
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      data: data,
      params: params
    });
    
    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`WordPress API error: ${error.response.data?.message || error.message}`);
    }
    throw error;
  }
}

// ================ USER TOOLS ================

// Get Users with advanced filtering
server.tool(
  "get-users",
  "Get a list of users from a WordPress site with advanced filtering options",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    context: z.enum(["view", "embed", "edit"]).optional().default("view").describe("Scope under which the request is made"),
    page: z.number().min(1).optional().default(1).describe("Current page of the collection"),
    perPage: z.number().min(1).max(100).optional().default(10).describe("Maximum number of items to be returned"),
    search: z.string().optional().describe("Limit results to those matching a string"),
    exclude: z.array(z.number()).optional().describe("Ensure result set excludes specific IDs"),
    include: z.array(z.number()).optional().describe("Limit result set to specific IDs"),
    offset: z.number().optional().describe("Offset the result set by a specific number of items"),
    order: z.enum(["asc", "desc"]).optional().default("asc").describe("Order sort attribute ascending or descending"),
    orderby: z.enum(["id", "include", "name", "registered_date", "slug", "include_slugs", "email", "url"]).optional().default("name").describe("Sort collection by user attribute"),
    slug: z.array(z.string()).optional().describe("Limit result set to users with one or more specific slugs"),
    roles: z.array(z.string()).optional().describe("Limit result set to users matching at least one specific role"),
    capabilities: z.array(z.string()).optional().describe("Limit result set to users matching at least one specific capability"),
    who: z.enum(["authors"]).optional().describe("Limit result set to users who are considered authors"),
    hasPublishedPosts: z.boolean().optional().describe("Limit result set to users who have published posts"),
  },
  async ({ 
    siteUrl, 
    username, 
    password, 
    context,
    page,
    perPage,
    search,
    exclude,
    include,
    offset,
    order,
    orderby,
    slug,
    roles,
    capabilities,
    who,
    hasPublishedPosts,
  }) => {
    try {
      const params: Record<string, any> = {
        context,
        page,
        per_page: perPage,
        order,
        orderby,
      };

      if (search) params.search = search;
      if (exclude) params.exclude = exclude.join(',');
      if (include) params.include = include.join(',');
      if (offset) params.offset = offset;
      if (slug) params.slug = slug.join(',');
      if (roles) params.roles = roles.join(',');
      if (capabilities) params.capabilities = capabilities.join(',');
      if (who) params.who = who;
      if (hasPublishedPosts !== undefined) params.has_published_posts = hasPublishedPosts;

      const users = await makeWPRequest<WPUser[]>({
        siteUrl,
        endpoint: "users",
        auth: { username, password },
        params
      });
      
      const formattedUsers = Array.isArray(users) ? users.map(user => ({
        id: user.id,
        name: user.name || "No name",
        slug: user.slug || "No slug",
        roles: user.roles || []
      })) : [];
      
      const usersText = formattedUsers.length > 0
        ? formattedUsers.map(user => 
            `ID: ${user.id}\nName: ${user.name}\nSlug: ${user.slug}\nRoles: ${user.roles.join(', ')}\n---`
          ).join("\n")
        : "No users found";
      
      return {
        content: [
          {
            type: "text",
            text: `Users from ${siteUrl}:\n\n${usersText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving users: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Get Single User
server.tool(
  "get-user",
  "Get a specific user by ID",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    userId: z.union([z.string(), z.number(), z.literal("me")]).describe("User ID or 'me' for current user"),
    context: z.enum(["view", "embed", "edit"]).optional().default("view").describe("Scope under which the request is made"),
  },
  async ({ siteUrl, username, password, userId, context }) => {
    try {
      const user = await makeWPRequest<WPUser>({
        siteUrl,
        endpoint: `users/${userId}`,
        auth: { username, password },
        params: { context }
      });
      
      return {
        content: [
          {
            type: "text",
            text: `User Details:\nID: ${user.id}\nName: ${user.name || "No name"}\nSlug: ${user.slug || "No slug"}\nRoles: ${user.roles?.join(', ') || "No roles"}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving user: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Create User
server.tool(
  "create-user",
  "Create a new WordPress user",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    newUsername: z.string().describe("Login name for the new user"),
    email: z.string().email().describe("Email address for the new user"),
    newPassword: z.string().describe("Password for the new user"),
    name: z.string().optional().describe("Display name for the user"),
    firstName: z.string().optional().describe("First name for the user"),
    lastName: z.string().optional().describe("Last name for the user"),
    url: z.string().url().optional().describe("URL of the user"),
    description: z.string().optional().describe("Description of the user"),
    locale: z.enum(["", "en_US"]).optional().describe("Locale for the user"),
    nickname: z.string().optional().describe("The nickname for the user"),
    slug: z.string().optional().describe("An alphanumeric identifier for the user"),
    roles: z.array(z.string()).optional().describe("Roles assigned to the user"),
  },
  async ({ 
    siteUrl, 
    username, 
    password,
    newUsername,
    email,
    newPassword,
    name,
    firstName,
    lastName,
    url,
    description,
    locale,
    nickname,
    slug,
    roles,
  }) => {
    try {
      const userData: Record<string, any> = {
        username: newUsername,
        email,
        password: newPassword,
      };

      if (name) userData.name = name;
      if (firstName) userData.first_name = firstName;
      if (lastName) userData.last_name = lastName;
      if (url) userData.url = url;
      if (description) userData.description = description;
      if (locale) userData.locale = locale;
      if (nickname) userData.nickname = nickname;
      if (slug) userData.slug = slug;
      if (roles) userData.roles = roles;

      const user = await makeWPRequest<WPUser>({
        siteUrl,
        endpoint: "users",
        method: "POST",
        auth: { username, password },
        data: userData
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully created user:\nID: ${user.id}\nUsername: ${newUsername}\nEmail: ${email}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating user: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Update User
server.tool(
  "update-user",
  "Update an existing WordPress user",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    userId: z.union([z.string(), z.number(), z.literal("me")]).describe("User ID or 'me' for current user"),
    newUsername: z.string().optional().describe("New login name for the user"),
    email: z.string().email().optional().describe("New email address for the user"),
    newPassword: z.string().optional().describe("New password for the user"),
    name: z.string().optional().describe("New display name for the user"),
    firstName: z.string().optional().describe("New first name for the user"),
    lastName: z.string().optional().describe("New last name for the user"),
    url: z.string().url().optional().describe("New URL of the user"),
    description: z.string().optional().describe("New description of the user"),
    locale: z.enum(["", "en_US"]).optional().describe("New locale for the user"),
    nickname: z.string().optional().describe("New nickname for the user"),
    slug: z.string().optional().describe("New alphanumeric identifier for the user"),
    roles: z.array(z.string()).optional().describe("New roles assigned to the user"),
  },
  async ({ 
    siteUrl, 
    username, 
    password,
    userId,
    newUsername,
    email,
    newPassword,
    name,
    firstName,
    lastName,
    url,
    description,
    locale,
    nickname,
    slug,
    roles,
  }) => {
    try {
      const userData: Record<string, any> = {};

      if (newUsername) userData.username = newUsername;
      if (email) userData.email = email;
      if (newPassword) userData.password = newPassword;
      if (name) userData.name = name;
      if (firstName) userData.first_name = firstName;
      if (lastName) userData.last_name = lastName;
      if (url) userData.url = url;
      if (description) userData.description = description;
      if (locale) userData.locale = locale;
      if (nickname) userData.nickname = nickname;
      if (slug) userData.slug = slug;
      if (roles) userData.roles = roles;

      if (Object.keys(userData).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No update data provided. Please specify at least one field to update.",
            },
          ],
        };
      }

      const user = await makeWPRequest<WPUser>({
        siteUrl,
        endpoint: `users/${userId}`,
        method: "POST",
        auth: { username, password },
        data: userData
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully updated user:\nID: ${user.id}\nUsername: ${user.name || newUsername || "Unchanged"}\nEmail: ${email || "Unchanged"}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating user: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Delete User
server.tool(
  "delete-user",
  "Delete a WordPress user",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    userId: z.union([z.string(), z.number(), z.literal("me")]).describe("User ID or 'me' for current user"),
    reassignId: z.number().describe("ID of the user to reassign posts to"),
  },
  async ({ siteUrl, username, password, userId, reassignId }) => {
    try {
      await makeWPRequest<any>({
        siteUrl,
        endpoint: `users/${userId}`,
        method: "DELETE",
        auth: { username, password },
        params: {
          force: true,
          reassign: reassignId
        }
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted user ${userId}. Posts have been reassigned to user ${reassignId}.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting user: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// ================ POST TOOLS ================

// List Posts
server.tool(
  "list-posts",
  "Get a list of posts with comprehensive filtering options",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    context: z.enum(["view", "embed", "edit"]).optional().default("view").describe("Scope under which the request is made"),
    page: z.number().min(1).optional().default(1).describe("Current page of the collection"),
    perPage: z.number().min(1).max(100).optional().default(10).describe("Maximum number of items to be returned"),
    search: z.string().optional().describe("Limit results to those matching a string"),
    after: z.string().optional().describe("Limit response to posts published after a given ISO8601 compliant date"),
    modifiedAfter: z.string().optional().describe("Limit response to posts modified after a given ISO8601 compliant date"),
    author: z.array(z.number()).optional().describe("Limit result set to posts assigned to specific authors"),
    authorExclude: z.array(z.number()).optional().describe("Ensure result set excludes posts assigned to specific authors"),
    before: z.string().optional().describe("Limit response to posts published before a given ISO8601 compliant date"),
    modifiedBefore: z.string().optional().describe("Limit response to posts modified before a given ISO8601 compliant date"),
    exclude: z.array(z.number()).optional().describe("Ensure result set excludes specific IDs"),
    include: z.array(z.number()).optional().describe("Limit result set to specific IDs"),
    offset: z.number().optional().describe("Offset the result set by a specific number of items"),
    order: z.enum(["asc", "desc"]).optional().default("desc").describe("Order sort attribute ascending or descending"),
    orderby: z.enum(["author", "date", "id", "include", "modified", "parent", "relevance", "slug", "include_slugs", "title"]).optional().default("date").describe("Sort collection by post attribute"),
    searchColumns: z.array(z.string()).optional().describe("Array of column names to be searched"),
    slug: z.array(z.string()).optional().describe("Limit result set to posts with one or more specific slugs"),
    status: z.array(z.enum(["publish", "future", "draft", "pending", "private"])).optional().default(["publish"]).describe("Limit result set to posts assigned one or more statuses"),
    taxRelation: z.enum(["AND", "OR"]).optional().describe("Limit result set based on relationship between multiple taxonomies"),
    categories: z.array(z.number()).optional().describe("Limit result set to items with specific terms assigned in the categories taxonomy"),
    categoriesExclude: z.array(z.number()).optional().describe("Limit result set to items except those with specific terms assigned in the categories taxonomy"),
    tags: z.array(z.number()).optional().describe("Limit result set to items with specific terms assigned in the tags taxonomy"),
    tagsExclude: z.array(z.number()).optional().describe("Limit result set to items except those with specific terms assigned in the tags taxonomy"),
    sticky: z.boolean().optional().describe("Limit result set to items that are sticky"),
  },
  async ({ 
    siteUrl, 
    username, 
    password,
    context,
    page,
    perPage,
    search,
    after,
    modifiedAfter,
    author,
    authorExclude,
    before,
    modifiedBefore,
    exclude,
    include,
    offset,
    order,
    orderby,
    searchColumns,
    slug,
    status,
    taxRelation,
    categories,
    categoriesExclude,
    tags,
    tagsExclude,
    sticky,
  }) => {
    try {
      const params: Record<string, any> = {
        context,
        page,
        per_page: perPage,
        order,
        orderby,
        status: status?.join(','),
      };

      if (search) params.search = search;
      if (after) params.after = after;
      if (modifiedAfter) params.modified_after = modifiedAfter;
      if (author) params.author = author.join(',');
      if (authorExclude) params.author_exclude = authorExclude.join(',');
      if (before) params.before = before;
      if (modifiedBefore) params.modified_before = modifiedBefore;
      if (exclude) params.exclude = exclude.join(',');
      if (include) params.include = include.join(',');
      if (offset) params.offset = offset;
      if (searchColumns) params.search_columns = searchColumns.join(',');
      if (slug) params.slug = slug.join(',');
      if (taxRelation) params.tax_relation = taxRelation;
      if (categories) params.categories = categories.join(',');
      if (categoriesExclude) params.categories_exclude = categoriesExclude.join(',');
      if (tags) params.tags = tags.join(',');
      if (tagsExclude) params.tags_exclude = tagsExclude.join(',');
      if (sticky !== undefined) params.sticky = sticky;

      const posts = await makeWPRequest<WPPost[]>({
        siteUrl,
        endpoint: "posts",
        auth: { username, password },
        params
      });
      
      const formattedPosts = Array.isArray(posts) ? posts.map(post => ({
        id: post.id,
        title: post.title?.rendered || "No title",
        date: post.date || "No date",
        status: post.status || "unknown",
        author: post.author || "Unknown",
        excerpt: post.excerpt?.rendered || "No excerpt"
      })) : [];
      
      const postsText = formattedPosts.length > 0
        ? formattedPosts.map(post => 
            `ID: ${post.id}\nTitle: ${post.title}\nDate: ${post.date}\nStatus: ${post.status}\nAuthor: ${post.author}\nExcerpt: ${post.excerpt}\n---`
          ).join("\n")
        : "No posts found";
      
      return {
        content: [
          {
            type: "text",
            text: `Posts from ${siteUrl}:\n\n${postsText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving posts: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Get Single Post
server.tool(
  "get-post",
  "Get a specific post by ID",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    postId: z.number().describe("ID of the post to retrieve"),
    context: z.enum(["view", "embed", "edit"]).optional().default("view").describe("Scope under which the request is made"),
    postPassword: z.string().optional().describe("The password for the post if it is password protected"),
  },
  async ({ siteUrl, username, password, postId, context, postPassword }) => {
    try {
      const params: Record<string, any> = { context };
      if (postPassword) params.password = postPassword;

      const post = await makeWPRequest<WPPost>({
        siteUrl,
        endpoint: `posts/${postId}`,
        auth: { username, password },
        params
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Post Details:\nID: ${post.id}\nTitle: ${post.title?.rendered || "No title"}\nDate: ${post.date || "No date"}\nStatus: ${post.status || "unknown"}\nAuthor: ${post.author || "Unknown"}\nContent: ${post.content?.rendered || "No content"}\nExcerpt: ${post.excerpt?.rendered || "No excerpt"}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving post: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Create Post
server.tool(
  "create-post",
  "Create a new WordPress post",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    title: z.string().describe("The title for the post"),
    content: z.string().describe("The content for the post"),
    status: z.enum(["publish", "future", "draft", "pending", "private"]).optional().default("draft").describe("A named status for the post"),
    date: z.string().optional().describe("The date the post was published, in the site's timezone"),
    dateGmt: z.string().optional().describe("The date the post was published, as GMT"),
    slug: z.string().optional().describe("An alphanumeric identifier for the post unique to its type"),
    postPassword: z.string().optional().describe("A password to protect access to the content and excerpt"),
    author: z.number().optional().describe("The ID for the author of the post"),
    excerpt: z.string().optional().describe("The excerpt for the post"),
    featuredMedia: z.number().optional().describe("The ID of the featured media for the post"),
    commentStatus: z.enum(["open", "closed"]).optional().default("open").describe("Whether or not comments are open on the post"),
    pingStatus: z.enum(["open", "closed"]).optional().default("open").describe("Whether or not the post can be pinged"),
    format: z.enum(["standard", "aside", "chat", "gallery", "link", "image", "quote", "status", "video", "audio"]).optional().default("standard").describe("The format for the post"),
    sticky: z.boolean().optional().describe("Whether or not the post should be treated as sticky"),
    template: z.string().optional().describe("The theme file to use to display the post"),
    categories: z.array(z.number()).optional().describe("The terms assigned to the post in the category taxonomy"),
    tags: z.array(z.number()).optional().describe("The terms assigned to the post in the post_tag taxonomy"),
    meta: z.record(z.any()).optional().describe("Meta fields"),
  },
  async ({ 
    siteUrl, 
    username, 
    password,
    title,
    content,
    status,
    date,
    dateGmt,
    slug,
    postPassword,
    author,
    excerpt,
    featuredMedia,
    commentStatus,
    pingStatus,
    format,
    sticky,
    template,
    categories,
    tags,
    meta,
  }) => {
    try {
      const postData: Record<string, any> = {
        title,
        content,
        status,
        comment_status: commentStatus,
        ping_status: pingStatus,
        format,
      };

      if (date) postData.date = date;
      if (dateGmt) postData.date_gmt = dateGmt;
      if (slug) postData.slug = slug;
      if (postPassword) postData.password = postPassword;
      if (author) postData.author = author;
      if (excerpt) postData.excerpt = excerpt;
      if (featuredMedia) postData.featured_media = featuredMedia;
      if (sticky !== undefined) postData.sticky = sticky;
      if (template) postData.template = template;
      if (categories) postData.categories = categories;
      if (tags) postData.tags = tags;
      if (meta) postData.meta = meta;

      const post = await makeWPRequest<WPPost>({
        siteUrl,
        endpoint: "posts",
        method: "POST",
        auth: { username, password },
        data: postData
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully created post:\nID: ${post.id}\nTitle: ${title}\nStatus: ${status}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating post: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Update Post
server.tool(
  "update-post",
  "Update an existing WordPress post",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    postId: z.number().describe("ID of the post to update"),
    title: z.string().optional().describe("New title for the post"),
    content: z.string().optional().describe("New content for the post"),
    status: z.enum(["publish", "future", "draft", "pending", "private"]).optional().describe("New status for the post"),
    date: z.string().optional().describe("New publication date in the site's timezone"),
    dateGmt: z.string().optional().describe("New publication date as GMT"),
    slug: z.string().optional().describe("New slug for the post"),
    postPassword: z.string().optional().describe("New password to protect access to the content and excerpt"),
    author: z.number().optional().describe("New author ID for the post"),
    excerpt: z.string().optional().describe("New excerpt for the post"),
    featuredMedia: z.number().optional().describe("New featured media ID for the post"),
    commentStatus: z.enum(["open", "closed"]).optional().describe("New comment status for the post"),
    pingStatus: z.enum(["open", "closed"]).optional().describe("New ping status for the post"),
    format: z.enum(["standard", "aside", "chat", "gallery", "link", "image", "quote", "status", "video", "audio"]).optional().describe("New format for the post"),
    sticky: z.boolean().optional().describe("New sticky status for the post"),
    template: z.string().optional().describe("New template for the post"),
    categories: z.array(z.number()).optional().describe("New categories for the post"),
    tags: z.array(z.number()).optional().describe("New tags for the post"),
    meta: z.record(z.any()).optional().describe("New meta fields"),
  },
  async ({ 
    siteUrl, 
    username, 
    password,
    postId,
    title,
    content,
    status,
    date,
    dateGmt,
    slug,
    postPassword,
    author,
    excerpt,
    featuredMedia,
    commentStatus,
    pingStatus,
    format,
    sticky,
    template,
    categories,
    tags,
    meta,
  }) => {
    try {
      const postData: Record<string, any> = {};

      if (title) postData.title = title;
      if (content) postData.content = content;
      if (status) postData.status = status;
      if (date) postData.date = date;
      if (dateGmt) postData.date_gmt = dateGmt;
      if (slug) postData.slug = slug;
      if (postPassword) postData.password = postPassword;
      if (author) postData.author = author;
      if (excerpt) postData.excerpt = excerpt;
      if (featuredMedia) postData.featured_media = featuredMedia;
      if (commentStatus) postData.comment_status = commentStatus;
      if (pingStatus) postData.ping_status = pingStatus;
      if (format) postData.format = format;
      if (sticky !== undefined) postData.sticky = sticky;
      if (template) postData.template = template;
      if (categories) postData.categories = categories;
      if (tags) postData.tags = tags;
      if (meta) postData.meta = meta;

      if (Object.keys(postData).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No update data provided. Please specify at least one field to update.",
            },
          ],
        };
      }

      const post = await makeWPRequest<WPPost>({
        siteUrl,
        endpoint: `posts/${postId}`,
        method: "POST",
        auth: { username, password },
        data: postData
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully updated post:\nID: ${post.id}\nTitle: ${post.title?.rendered || title || "Unchanged"}\nStatus: ${post.status || status || "Unchanged"}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating post: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Delete Post
server.tool(
  "delete-post",
  "Delete a WordPress post",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    postId: z.number().describe("ID of the post to delete"),
    force: z.boolean().optional().default(false).describe("Whether to bypass Trash and force deletion"),
  },
  async ({ siteUrl, username, password, postId, force }) => {
    try {
      await makeWPRequest<any>({
        siteUrl,
        endpoint: `posts/${postId}`,
        method: "DELETE",
        auth: { username, password },
        params: { force }
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted post ${postId}${force ? " (forced deletion)" : " (moved to trash)"}.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting post: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// ================ COMMENT TOOLS ================

server.tool(
  "get-comments",
  "Get a list of comments from a WordPress site",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    postId: z.number().optional().describe("Filter comments by post ID"),
    perPage: z.number().min(1).max(100).optional().describe("Number of comments per page"),
    page: z.number().min(1).optional().describe("Page number"),
  },
  async ({ siteUrl, username, password, postId, perPage = 10, page = 1 }) => {
    try {
      const params: Record<string, any> = { per_page: perPage, page };
      if (postId !== undefined) params.post = postId;
      
      const comments = await makeWPRequest<WPComment[]>({
        siteUrl,
        endpoint: "comments",
        auth: { username, password },
        params
      });
      
      const formattedComments = Array.isArray(comments) ? comments.map(comment => ({
        id: comment.id,
        author_name: comment.author_name || "Anonymous",
        content: comment.content?.rendered || "No content",
        post: comment.post || "Unknown post",
        date: comment.date || "No date"
      })) : [];
      
      const commentsText = formattedComments.length > 0
        ? formattedComments.map(comment => 
            `ID: ${comment.id}\nAuthor: ${comment.author_name}\nDate: ${comment.date}\nContent: ${comment.content}\n---`
          ).join("\n")
        : "No comments found";
      
      return {
        content: [
          {
            type: "text",
            text: `Comments from ${siteUrl}${postId ? ` for post #${postId}` : ''}:\n\n${commentsText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving comments: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "create-comment",
  "Create a new comment on a WordPress post",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    postId: z.number().describe("ID of the post to comment on"),
    content: z.string().describe("Comment content"),
    author_name: z.string().optional().describe("Comment author name (for users who can't set this)"),
    author_email: z.string().email().optional().describe("Comment author email (for users who can't set this)"),
  },
  async ({ siteUrl, username, password, postId, content, author_name, author_email }) => {
    try {
      const commentData: Record<string, any> = {
        post: postId,
        content
      };
      
      if (author_name) commentData.author_name = author_name;
      if (author_email) commentData.author_email = author_email;
      
      const comment = await makeWPRequest<WPComment>({
        siteUrl,
        endpoint: "comments",
        method: "POST",
        auth: { username, password },
        data: commentData
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully created comment with ID: ${comment.id} on post #${postId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating comment: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// ================ STATS TOOLS ================

server.tool(
  "get-stats-highlights",
  "Get highlight metrics for a WordPress site from the last seven days",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
  },
  async ({ siteUrl, username, password, siteId }) => {
    try {
      const highlights = await makeWPRequest<WPStatsHighlights>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/highlights`,
        auth: { username, password }
      });
      
      const highlightsText = `
Stats Highlights for site #${siteId}:
Period: ${highlights.period || "Last 7 days"}
Views: ${highlights.views || 0}
Visitors: ${highlights.visitors || 0}
Likes: ${highlights.likes || 0}
Comments: ${highlights.comments || 0}
Followers: ${highlights.followers || 0}
Posts: ${highlights.posts || 0}
      `.trim();
      
      return {
        content: [
          {
            type: "text",
            text: highlightsText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving stats highlights: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 2. Stats Summary
server.tool(
  "get-stats-summary",
  "View a site's summarized views, visitors, likes and comments",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
  },
  async ({ siteUrl, username, password, siteId }) => {
    try {
      const summary = await makeWPRequest<WPStatsSummary>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/summary`,
        auth: { username, password }
      });
      
      const summaryText = `
Stats Summary for site #${siteId}:

Views:
Total: ${summary.views?.total || 0}
${summary.views?.fields?.map(f => `${f.period}: ${f.value}`).join('\n') || "No data"}

Visitors:
Total: ${summary.visitors?.total || 0}
${summary.visitors?.fields?.map(f => `${f.period}: ${f.value}`).join('\n') || "No data"}

Likes:
Total: ${summary.likes?.total || 0}
${summary.likes?.fields?.map(f => `${f.period}: ${f.value}`).join('\n') || "No data"}

Comments:
Total: ${summary.comments?.total || 0}
${summary.comments?.fields?.map(f => `${f.period}: ${f.value}`).join('\n') || "No data"}
      `.trim();
      
      return {
        content: [
          {
            type: "text",
            text: summaryText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving stats summary: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 3. Top Posts
server.tool(
  "get-top-posts",
  "View a site's top posts and pages by views",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
    period: z.enum(["day", "week", "month", "year"]).optional().describe("Time period for stats"),
    limit: z.number().min(1).max(100).optional().describe("Maximum number of posts to return"),
  },
  async ({ siteUrl, username, password, siteId, period = "week", limit = 10 }) => {
    try {
      const topPosts = await makeWPRequest<{posts: WPTopPost[]}>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/top-posts`,
        auth: { username, password },
        params: { period, limit }
      });
      
      const postsText = Array.isArray(topPosts.posts) && topPosts.posts.length > 0
        ? topPosts.posts.map((post, index) => 
            `${index + 1}. "${post.title}" (ID: ${post.id})
Views: ${post.views || 0}
Comments: ${post.comment_count || 0}
Likes: ${post.likes || 0}
URL: ${post.url || "No URL"}
---`
          ).join("\n")
        : "No top posts found";
      
      return {
        content: [
          {
            type: "text",
            text: `Top Posts for site #${siteId} (${period}):\n\n${postsText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving top posts: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 4. Referrers
server.tool(
  "get-referrers",
  "View a site's referrers",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
    period: z.enum(["day", "week", "month", "year"]).optional().describe("Time period for stats"),
    limit: z.number().min(1).max(100).optional().describe("Maximum number of referrers to return"),
  },
  async ({ siteUrl, username, password, siteId, period = "week", limit = 10 }) => {
    try {
      const referrersData = await makeWPRequest<{referrers: WPReferrer[]}>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/referrers`,
        auth: { username, password },
        params: { period, limit }
      });
      
      const referrersText = Array.isArray(referrersData.referrers) && referrersData.referrers.length > 0
        ? referrersData.referrers.map((ref) => 
            `${ref.name || "Unknown"} (${ref.group || "Unknown Group"})
URL: ${ref.url || "No URL"}
Views: ${ref.views || 0}
${ref.is_spam ? "⚠️ Marked as spam" : ""}
---`
          ).join("\n")
        : "No referrers found";
      
      return {
        content: [
          {
            type: "text",
            text: `Referrers for site #${siteId} (${period}):\n\n${referrersText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving referrers: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 5. Country Views
server.tool(
  "get-country-views",
  "View a site's views by country",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
    period: z.enum(["day", "week", "month", "year"]).optional().describe("Time period for stats"),
    limit: z.number().min(1).max(100).optional().describe("Maximum number of countries to return"),
  },
  async ({ siteUrl, username, password, siteId, period = "week", limit = 10 }) => {
    try {
      const countryData = await makeWPRequest<{country_views: WPCountryView[]}>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/country-views`,
        auth: { username, password },
        params: { period, limit }
      });
      
      const countriesText = Array.isArray(countryData.country_views) && countryData.country_views.length > 0
        ? countryData.country_views.map((country) => 
            `${country.country_name || "Unknown"} (${country.country_code || "??"})
Views: ${country.views || 0}
Percentage: ${country.views_percent ? Math.round(country.views_percent * 100) / 100 + '%' : "0%"}
---`
          ).join("\n")
        : "No country data found";
      
      return {
        content: [
          {
            type: "text",
            text: `Views by Country for site #${siteId} (${period}):\n\n${countriesText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving country views: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 6. Post Stats
server.tool(
  "get-post-stats",
  "View a specific post's views",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
    postId: z.number().describe("Post ID to get stats for"),
  },
  async ({ siteUrl, username, password, siteId, postId }) => {
    try {
      const postStats = await makeWPRequest<any>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/post/${postId}`,
        auth: { username, password }
      });
      
      // Format will depend on the actual API response
      let statsText;
      
      if (postStats && typeof postStats.views !== 'undefined') {
        statsText = `
Post #${postId} Stats:
Total Views: ${postStats.views || 0}
First View: ${postStats.first_view || "Unknown"}
Most Recent View: ${postStats.most_recent_view || "Unknown"}
        `.trim();
      } else if (postStats && Array.isArray(postStats.data)) {
        // Handle timeframe data if present
        statsText = `
Post #${postId} Views Over Time:
${postStats.data.map((item: WPPostStatsData) => `${item.period || "Unknown"}: ${item.views || 0} views`).join('\n')}
        `.trim();
      } else {
        statsText = `Post #${postId} Stats:\n${JSON.stringify(postStats, null, 2)}`;
      }
      
      return {
        content: [
          {
            type: "text",
            text: statsText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving post stats: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 7. All Stats
server.tool(
  "get-site-stats",
  "Get comprehensive stats for a WordPress site",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
    period: z.enum(["day", "week", "month", "year"]).optional().describe("Time period for stats"),
  },
  async ({ siteUrl, username, password, siteId, period = "week" }) => {
    try {
      const stats = await makeWPRequest<any>({
        siteUrl,
        endpoint: `sites/${siteId}/stats`,
        auth: { username, password },
        params: { period }
      });
      
      // Format general site stats - fields will depend on API response
      let statsText = `Site #${siteId} Stats (${period}):\n\n`;
      
      if (stats) {
        // Add visitors and views if available
        if (stats.visits) {
          statsText += `Visitors: ${stats.visits || 0}\n`;
        }
        if (stats.views) {
          statsText += `Views: ${stats.views || 0}\n`;
        }
        
        // Add top posts if available
        if (stats.top_posts && Array.isArray(stats.top_posts)) {
          statsText += `\nTop Posts:\n`;
          statsText += stats.top_posts.slice(0, 5).map((post: any, index: number) => 
            `${index + 1}. "${post.title || "Untitled"}" - ${post.views || 0} views`
          ).join('\n');
        }
        
        // Add top referrers if available
        if (stats.referrers && Array.isArray(stats.referrers)) {
          statsText += `\n\nTop Referrers:\n`;
          statsText += stats.referrers.slice(0, 5).map((ref: any) => 
            `${ref.name || "Unknown"}: ${ref.views || 0} views`
          ).join('\n');
        }
        
        // Add more sections based on what's available in the API response
      } else {
        statsText += "No stats data found.";
      }
      
      return {
        content: [
          {
            type: "text",
            text: statsText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving site stats: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 8. Report Referrer as Spam
server.tool(
  "report-referrer-spam",
  "Report a referrer as spam",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
    domain: z.string().describe("Domain to report as spam"),
  },
  async ({ siteUrl, username, password, siteId, domain }) => {
    try {
      const response = await makeWPRequest<any>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/referrers/spam/new`,
        method: "POST",
        auth: { username, password },
        data: { domain }
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully reported domain "${domain}" as spam.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error reporting referrer as spam: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 9. Remove Referrer from Spam
server.tool(
  "remove-referrer-spam",
  "Unreport a referrer as spam",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
    domain: z.string().describe("Domain to remove from spam list"),
  },
  async ({ siteUrl, username, password, siteId, domain }) => {
    try {
      const response = await makeWPRequest<any>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/referrers/spam/delete`,
        method: "POST",
        auth: { username, password },
        data: { domain }
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully removed domain "${domain}" from spam list.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error removing referrer from spam list: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 10. Get Clicks
server.tool(
  "get-clicks",
  "View a site's outbound clicks",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
    period: z.enum(["day", "week", "month", "year"]).optional().describe("Time period for stats"),
    limit: z.number().min(1).max(100).optional().describe("Maximum number of click items to return"),
  },
  async ({ siteUrl, username, password, siteId, period = "week", limit = 10 }) => {
    try {
      const clicksData = await makeWPRequest<any>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/clicks`,
        auth: { username, password },
        params: { period, limit }
      });
      
      // Format will depend on the actual API response
      const clicksText = Array.isArray(clicksData.clicks) && clicksData.clicks.length > 0
        ? clicksData.clicks.map((click: any) => 
            `${click.name || click.url || "Unknown URL"}
Clicks: ${click.clicks || 0}
URL: ${click.url || "No URL"}
---`
          ).join("\n")
        : "No outbound clicks found";
      
      return {
        content: [
          {
            type: "text",
            text: `Outbound Clicks for site #${siteId} (${period}):\n\n${clicksText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving clicks data: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 11. Get Search Terms
server.tool(
  "get-search-terms",
  "View search terms used to find the site",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
    period: z.enum(["day", "week", "month", "year"]).optional().describe("Time period for stats"),
    limit: z.number().min(1).max(100).optional().describe("Maximum number of search terms to return"),
  },
  async ({ siteUrl, username, password, siteId, period = "week", limit = 10 }) => {
    try {
      const searchData = await makeWPRequest<any>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/search-terms`,
        auth: { username, password },
        params: { period, limit }
      });
      
      const searchTermsText = Array.isArray(searchData.search_terms) && searchData.search_terms.length > 0
        ? searchData.search_terms.map((term: any) => 
            `"${term.term || "Unknown"}"
Views: ${term.views || 0}
---`
          ).join("\n")
        : "No search terms found or search terms are encrypted";
      
      return {
        content: [
          {
            type: "text",
            text: `Search Terms for site #${siteId} (${period}):\n\n${searchTermsText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving search terms: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 12. Get Streak Stats (Calendar Heatmap)
server.tool(
  "get-streak-stats",
  "Get stats for Calendar Heatmap showing publishing activity",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    siteId: z.number().describe("WordPress site ID"),
  },
  async ({ siteUrl, username, password, siteId }) => {
    try {
      const streakData = await makeWPRequest<any>({
        siteUrl,
        endpoint: `sites/${siteId}/stats/streak`,
        auth: { username, password }
      });
      
      let streakText = `Publishing Activity for site #${siteId}:\n\n`;
      
      if (streakData && Array.isArray(streakData.data)) {
        // Group by month/year for better readability
        const groupedByMonth: Record<string, any[]> = {};
        
        streakData.data.forEach((day: any) => {
          if (!day.date) return;
          
          const date = new Date(day.date);
          const monthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
          
          if (!groupedByMonth[monthYear]) {
            groupedByMonth[monthYear] = [];
          }
          
          groupedByMonth[monthYear].push({
            date: date.toLocaleDateString(),
            count: day.count || 0
          });
        });
        
        // Format the output
        Object.keys(groupedByMonth).forEach(monthYear => {
          streakText += `${monthYear}:\n`;
          
          const days = groupedByMonth[monthYear];
          const activeDays = days.filter(day => day.count > 0);
          
          if (activeDays.length > 0) {
            streakText += activeDays.map(day => `${day.date}: ${day.count} post(s)`).join('\n');
          } else {
            streakText += "No publishing activity this month";
          }
          
          streakText += "\n\n";
        });
      } else {
        streakText += "No publishing activity data found.";
      }
      
      return {
        content: [
          {
            type: "text",
            text: streakText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving streak stats: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// ================ CATEGORY TOOLS ================

// List Categories
server.tool(
  "list-categories",
  "Get a list of categories with filtering options",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    context: z.enum(["view", "embed", "edit"]).optional().default("view").describe("Scope under which the request is made"),
    page: z.number().min(1).optional().default(1).describe("Current page of the collection"),
    perPage: z.number().min(1).max(100).optional().default(10).describe("Maximum number of items to be returned"),
    search: z.string().optional().describe("Limit results to those matching a string"),
    exclude: z.array(z.number()).optional().describe("Ensure result set excludes specific IDs"),
    include: z.array(z.number()).optional().describe("Limit result set to specific IDs"),
    order: z.enum(["asc", "desc"]).optional().default("asc").describe("Order sort attribute ascending or descending"),
    orderby: z.enum(["id", "include", "name", "slug", "include_slugs", "term_group", "description", "count"]).optional().default("name").describe("Sort collection by term attribute"),
    hideEmpty: z.boolean().optional().describe("Whether to hide terms not assigned to any posts"),
    parent: z.number().optional().describe("Limit result set to terms assigned to a specific parent"),
    post: z.number().optional().describe("Limit result set to terms assigned to a specific post"),
    slug: z.array(z.string()).optional().describe("Limit result set to terms with one or more specific slugs"),
  },
  async ({ 
    siteUrl, 
    username, 
    password,
    context,
    page,
    perPage,
    search,
    exclude,
    include,
    order,
    orderby,
    hideEmpty,
    parent,
    post,
    slug,
  }) => {
    try {
      const params: Record<string, any> = {
        context,
        page,
        per_page: perPage,
        order,
        orderby,
      };

      if (search) params.search = search;
      if (exclude) params.exclude = exclude.join(',');
      if (include) params.include = include.join(',');
      if (hideEmpty !== undefined) params.hide_empty = hideEmpty;
      if (parent) params.parent = parent;
      if (post) params.post = post;
      if (slug) params.slug = slug.join(',');

      const categories = await makeWPRequest<WPCategory[]>({
        siteUrl,
        endpoint: "categories",
        auth: { username, password },
        params
      });
      
      const formattedCategories = Array.isArray(categories) ? categories.map(category => ({
        id: category.id,
        name: category.name || "No name",
        slug: category.slug || "No slug",
        description: category.description || "No description",
        parent: category.parent || 0,
        count: category.count || 0
      })) : [];
      
      const categoriesText = formattedCategories.length > 0
        ? formattedCategories.map(category => 
            `ID: ${category.id}\nName: ${category.name}\nSlug: ${category.slug}\nDescription: ${category.description}\nParent ID: ${category.parent}\nPost Count: ${category.count}\n---`
          ).join("\n")
        : "No categories found";
      
      return {
        content: [
          {
            type: "text",
            text: `Categories from ${siteUrl}:\n\n${categoriesText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving categories: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Get Single Category
server.tool(
  "get-category",
  "Get a specific category by ID",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    categoryId: z.number().describe("ID of the category to retrieve"),
    context: z.enum(["view", "embed", "edit"]).optional().default("view").describe("Scope under which the request is made"),
  },
  async ({ siteUrl, username, password, categoryId, context }) => {
    try {
      const category = await makeWPRequest<WPCategory>({
        siteUrl,
        endpoint: `categories/${categoryId}`,
        auth: { username, password },
        params: { context }
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Category Details:\nID: ${category.id}\nName: ${category.name || "No name"}\nSlug: ${category.slug || "No slug"}\nDescription: ${category.description || "No description"}\nParent ID: ${category.parent || 0}\nPost Count: ${category.count || 0}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving category: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Create Category
server.tool(
  "create-category",
  "Create a new WordPress category",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    name: z.string().describe("HTML title for the term"),
    description: z.string().optional().describe("HTML description of the term"),
    slug: z.string().optional().describe("An alphanumeric identifier for the term unique to its type"),
    parent: z.number().optional().describe("The parent term ID"),
    meta: z.record(z.any()).optional().describe("Meta fields"),
  },
  async ({ 
    siteUrl, 
    username, 
    password,
    name,
    description,
    slug,
    parent,
    meta,
  }) => {
    try {
      const categoryData: Record<string, any> = { name };

      if (description) categoryData.description = description;
      if (slug) categoryData.slug = slug;
      if (parent) categoryData.parent = parent;
      if (meta) categoryData.meta = meta;

      const category = await makeWPRequest<WPCategory>({
        siteUrl,
        endpoint: "categories",
        method: "POST",
        auth: { username, password },
        data: categoryData
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully created category:\nID: ${category.id}\nName: ${name}\nSlug: ${category.slug || "No slug"}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating category: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Update Category
server.tool(
  "update-category",
  "Update an existing WordPress category",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    categoryId: z.number().describe("ID of the category to update"),
    name: z.string().optional().describe("New HTML title for the term"),
    description: z.string().optional().describe("New HTML description of the term"),
    slug: z.string().optional().describe("New alphanumeric identifier for the term"),
    parent: z.number().optional().describe("New parent term ID"),
    meta: z.record(z.any()).optional().describe("New meta fields"),
  },
  async ({ 
    siteUrl, 
    username, 
    password,
    categoryId,
    name,
    description,
    slug,
    parent,
    meta,
  }) => {
    try {
      const categoryData: Record<string, any> = {};

      if (name) categoryData.name = name;
      if (description) categoryData.description = description;
      if (slug) categoryData.slug = slug;
      if (parent) categoryData.parent = parent;
      if (meta) categoryData.meta = meta;

      if (Object.keys(categoryData).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No update data provided. Please specify at least one field to update.",
            },
          ],
        };
      }

      const category = await makeWPRequest<WPCategory>({
        siteUrl,
        endpoint: `categories/${categoryId}`,
        method: "POST",
        auth: { username, password },
        data: categoryData
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully updated category:\nID: ${category.id}\nName: ${category.name || name || "Unchanged"}\nSlug: ${category.slug || slug || "Unchanged"}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating category: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Delete Category
server.tool(
  "delete-category",
  "Delete a WordPress category",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    categoryId: z.number().describe("ID of the category to delete"),
    force: z.boolean().optional().default(true).describe("Required to be true, as terms do not support trashing"),
  },
  async ({ siteUrl, username, password, categoryId, force }) => {
    try {
      await makeWPRequest<any>({
        siteUrl,
        endpoint: `categories/${categoryId}`,
        method: "DELETE",
        auth: { username, password },
        params: { force }
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted category ${categoryId}.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting category: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// ================ MAIN FUNCTION ================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WordPress MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});