# Backend Wizards — Stage 0: Dynamic Profile Endpoint

## Overview
This project implements a simple RESTful API using Node.js and Fastify that exposes a `/me` endpoint. The endpoint returns a JSON response with user profile information, a dynamic timestamp, and a random cat fact fetched from the [Cat Facts API](https://catfact.ninja/fact). 

The implementation follows best practices including error handling for the external API, timeouts, logging, and CORS support.

## Features
- **GET /me**: Returns user profile, current UTC timestamp (ISO 8601), and a fresh cat fact.
- Graceful degradation: If the Cat Facts API fails, a fallback fact is used while maintaining the "success" status.
- Dynamic data: Timestamp updates on every request; cat fact is fetched anew each time (no caching).
- Logging: Built-in Fastify logger for debugging.
- CORS: Enabled for cross-origin requests.

## Tech Stack
- Node.js (^18.0.0)
- Fastify (^4.28.1) as the web framework
- @fastify/cors (^9.0.1) for CORS handling
- dotenv

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- npm (comes with Node.js)

### Installation
1. Clone the repository

  git clone https://github.com/slattware/hng13-stage0-backend.git

2. Install dependencies

npm install

3. Set environment variables (optional but recommended):
Create a `.env` file in the root directory:

Note: The app falls back to default values if env vars are not set.

### Running Locally
1. Start the development server:

2. The server will listen on `http://localhost:3000` (or the PORT env var).

3. Test the endpoint:
- Visit `http://localhost:3000/me` in your browser or use curl:
  ```
  curl http://localhost:3000/me
  ```
- Expected response:
  ```json
  {
    "status": "success",
    "user": {
      "email": "your-email@example.com",
      "name": "Your Full Name",
      "stack": "Node.js/Fastify"
    },
    "timestamp": "2025-10-19T10:30:45.123Z",
    "fact": "Cats have over 20 muscles that control their ears."
  }
  ```

### Testing
- **Manual Testing**: Use tools like Postman, curl, or browser to hit `/me` multiple times. Verify:
- Timestamp updates.
- Cat fact changes (or falls back if API down).
- JSON structure and Content-Type.
- Verify from multiple networks to ensure accessibility.


### Environment Variables
| Variable      | Description                  | Default Value              | Required? |
|---------------|------------------------------|----------------------------|-----------|
| USER_EMAIL   | Your email address           | 'your-email@example.com'  | No       |
| USER_NAME    | Your full name               | 'Your Full Name'           | No       |
| USER_STACK   | Backend stack (e.g., 'Node.js/Fastify') | 'Node.js/Fastify' | No       |
| PORT         | Server port                  | 3000                       | No       |

### Notes
- **Error Handling**: Network errors/timeouts log warnings but return a fallback to keep the response "success".
- **Security**: In production, validate/sanitize inputs, use HTTPS, and restrict CORS origins.

## License
MIT License - see LICENSE file.