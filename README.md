# threads-ts

A TypeScript SDK for the Threads API, making it easy to interact with Threads in your TypeScript/JavaScript projects.

[![npm version](https://badge.fury.io/js/threads-ts.svg)](https://badge.fury.io/js/threads-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Official Threads Documentation:
https://developers.facebook.com/docs/threads

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Installation

Install the package using npm:

```bash
npm install threads-ts
```

Or using yarn:

```bash
yarn add threads-ts
```

## Usage

First, import and initialize the ThreadsAPI class:

```typescript
import { ThreadsAPI, ThreadsAPIConfig } from 'threads-ts';

const config: ThreadsAPIConfig = {
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'YOUR_REDIRECT_URI',
  scope: ['threads_basic', 'threads_content_publish']
};

const threadsAPI = new ThreadsAPI(config);
```

### Authentication

Generate an authorization URL:

```typescript
const authUrl = threadsAPI.getAuthorizationUrl();
console.log('Authorize your app:', authUrl);
```

Exchange the authorization code for an access token:

```typescript
const code = 'AUTHORIZATION_CODE';
const tokenResponse = await threadsAPI.getAccessToken(code);
console.log('Access Token:', tokenResponse.access_token);

// Set the access token for future requests
threadsAPI.setAccessToken(tokenResponse.access_token);
```

### Creating and Publishing a Thread

```typescript
const userId = 'USER_ID';

// Create a media container
const creationId = await threadsAPI.createMediaContainer({
  userId,
  mediaType: 'TEXT',
  text: 'Hello, Threads!'
});

// Publish the media container
const threadId = await threadsAPI.publishMediaContainer({
  userId,
  creationId
});

console.log('Published Thread ID:', threadId);
```

### Retrieving User Threads

```typescript
const userId = 'USER_ID';
const fields = ['id', 'text', 'username', 'timestamp'];

const userThreads = await threadsAPI.getUserThreads({
  userId,
  fields,
  options: { limit: 10 }
});

console.log('User Threads:', userThreads);
```

### Retrieving User Profile

```typescript
const userId = 'USER_ID';
const fields = ['id', 'username', 'name', 'threads_profile_picture_url'];

const userProfile = await threadsAPI.getUserProfile({
  userId,
  fields
});

console.log('User Profile:', userProfile);
```

### Retrieving Replies to a Thread

```typescript
const mediaId = 'THREAD_ID';
const fields = ['id', 'text', 'username', 'timestamp'];

const replies = await threadsAPI.getReplies({
  mediaId,
  fields
});

console.log('Replies:', replies);
```

### Responding to a Reply

```typescript
const userId = 'USER_ID';
const replyToId = 'THREAD_ID_TO_REPLY_TO';

const replyId = await threadsAPI.respondToReply({
  userId,
  mediaType: 'TEXT',
  text: 'This is my response!',
  replyToId
});

console.log('Reply ID:', replyId);
```

### Retrieving Media Insights

```typescript
const mediaId = 'THREAD_ID';
const metrics = ['engagement', 'impressions', 'reach'];

const insights = await threadsAPI.getMediaInsights({
  mediaId,
  metrics
});

console.log('Media Insights:', insights);
```

## API Reference

For a complete list of available methods and their parameters, please refer to the [API documentation](https://github.com/solojungle/threads-ts/blob/main/API.md).

## Contributing

We welcome contributions to the threads-ts SDK! Here's how you can help:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please make sure to update tests as appropriate and adhere to the existing coding style.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/solojungle/threads-ts/issues) on GitHub.

## Acknowledgements

- Thanks to the Threads team for providing the API
- All the contributors who have helped improve this SDK

---

Made with ❤️ by [solojungle](https://github.com/solojungle)