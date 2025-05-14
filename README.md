[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/prathammanocha-wordpress-mcp-server-badge.png)](https://mseep.ai/app/prathammanocha-wordpress-mcp-server)

# Comprehensive WordPress MCP Server

A comprehensive Model Context Protocol (MCP) server that enables AI assistants to interact with WordPress sites through the WordPress REST API. This server provides tools for managing all aspects of WordPress programmatically, including posts, users, comments, categories, tags, and custom endpoints.

<a href="https://glama.ai/mcp/servers/@prathammanocha/wordpress-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@prathammanocha/wordpress-mcp-server/badge" alt="WordPress Server MCP server" />
</a>

## Features

### Post Management
- Create, retrieve, update, and delete WordPress posts
- Filter posts by various parameters
- Pagination support for post listings

### User Management
- Retrieve user information by ID or login
- Update user details
- Delete users

### Comments Management
- Create, retrieve, update, and delete comments
- Filter comments by post
- Pagination support for comment listings

### Taxonomy Management
- Manage categories and tags
- Create, retrieve, update, and delete taxonomies
- Find categories and tags by slug

### Site Information
- Retrieve general WordPress site information

### Custom Requests
- Support for custom REST API endpoints
- Custom HTTP methods (GET, POST, PUT, DELETE)
- Custom data and parameters

## Prerequisites

- Node.js v18 or higher
- A WordPress site with REST API enabled
- WordPress application password for authentication

## Installation

1. Clone this repository:
```bash
git clone [repository-url]
cd wordpress-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

## WordPress Configuration

Before using the server, you need to set up your WordPress site:

1. Ensure your WordPress site has REST API enabled (enabled by default in WordPress 4.7+)
2. Create an application password:
   - Log in to your WordPress admin panel
   - Go to Users → Profile
   - Scroll down to "Application Passwords"
   - Enter a name for the application (e.g., "MCP Server")
   - Click "Add New Application Password"
   - Copy the generated password (you won't be able to see it again)

## MCP Configuration

Add the server to your MCP settings file (usually located at `~/AppData/Roaming/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "wordpress": {
      "command": "node",
      "args": ["path/to/wordpress-mcp-server/build/index.js"]
    }
  }
}
```

## Available Tools

### Post Management

#### 1. create_post
Creates a new WordPress post.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `title` (required): Post title
- `content` (required): Post content
- `status` (optional): Post status ('draft', 'publish', or 'private', defaults to 'draft')

**Example:**
```json
{
  "tool": "create_post",
  "siteUrl": "https://example.com",
  "username": "admin",
  "password": "xxxx xxxx xxxx xxxx",
  "title": "My First Post",
  "content": "Hello, world!",
  "status": "draft"
}
```

#### 2. get_posts
Retrieves WordPress posts with pagination.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `perPage` (optional): Number of posts per page (default: 10)
- `page` (optional): Page number (default: 1)
- `customParams` (optional): Additional query parameters

**Example:**
```json
{
  "tool": "get_posts",
  "siteUrl": "https://example.com",
  "username": "admin",
  "password": "xxxx xxxx xxxx xxxx",
  "perPage": 5,
  "page": 1
}
```

#### 3. update_post
Updates an existing WordPress post.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `postId` (required): ID of the post to update
- `title` (optional): New post title
- `content` (optional): New post content
- `status` (optional): New post status ('draft', 'publish', or 'private')

**Example:**
```json
{
  "tool": "update_post",
  "siteUrl": "https://example.com",
  "username": "admin",
  "password": "xxxx xxxx xxxx xxxx",
  "postId": 123,
  "title": "Updated Title",
  "content": "Updated content",
  "status": "publish"
}
```

#### 4. delete_post
Deletes a WordPress post.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `postId` (required): ID of the post to delete

**Example:**
```json
{
  "tool": "delete_post",
  "siteUrl": "https://example.com",
  "username": "admin",
  "password": "xxxx xxxx xxxx xxxx",
  "postId": 123
}
```

### User Management

#### 1. get_users
Retrieves WordPress users.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `perPage` (optional): Number of users per page (default: 10)
- `page` (optional): Page number (default: 1)

#### 2. get_user
Retrieves a specific WordPress user by ID.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `userId` (required): ID of the user to retrieve

#### 3. get_user_by_login
Retrieves a WordPress user by login name.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `userLogin` (required): Login name of the user to retrieve

### Comment Management

#### 1. get_comments
Retrieves WordPress comments.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `perPage` (optional): Number of comments per page (default: 10)
- `page` (optional): Page number (default: 1)
- `postIdForComment` (optional): Filter comments by post ID

#### 2. create_comment
Creates a new comment on a post.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `postIdForComment` (required): ID of the post to comment on
- `commentContent` (required): Content of the comment
- `customData` (optional): Additional comment data

### Category and Tag Management

#### 1. get_categories
Retrieves WordPress categories.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `perPage` (optional): Number of categories per page (default: 10)
- `page` (optional): Page number (default: 1)

#### 2. create_category
Creates a new WordPress category.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `categoryName` (required): Name of the category to create
- `customData` (optional): Additional category data (description, parent, etc.)

### Custom Requests

#### 1. custom_request
Makes a custom request to any WordPress REST API endpoint.

**Parameters:**
- `siteUrl` (required): Your WordPress site URL
- `username` (required): WordPress username
- `password` (required): WordPress application password
- `customEndpoint` (required): API endpoint path
- `customMethod` (optional): HTTP method ('GET', 'POST', 'PUT', 'DELETE', default: 'GET')
- `customData` (optional): Data for POST/PUT requests
- `customParams` (optional): URL parameters for GET requests

**Example:**
```json
{
  "tool": "custom_request",
  "siteUrl": "https://example.com",
  "username": "admin",
  "password": "xxxx xxxx xxxx xxxx",
  "customEndpoint": "wp/v2/media",
  "customMethod": "GET",
  "customParams": {
    "per_page": 5
  }
}
```

## Response Format

All tools return responses in the following format:

### Success Response
```json
{
  "success": true,
  "data": {
    // WordPress API response data
  },
  "meta": {
    // Optional metadata (pagination info, etc.)
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Security Considerations

- Always use HTTPS URLs for your WordPress site
- Use application passwords instead of your main WordPress password
- Keep your application passwords secure and don't share them
- Consider using WordPress roles and capabilities to limit access
- Regularly rotate application passwords

## Development

To contribute to the development:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests (when available)
5. Submit a pull request

For development mode with automatic recompilation:
```bash
npm run dev
```

## License

This project is licensed under the ISC License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.