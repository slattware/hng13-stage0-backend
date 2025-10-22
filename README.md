String Analyzer Service
A RESTful API service built with Fastify that analyzes strings and stores their computed properties.
Setup Instructions
Prerequisites

Node.js (v16 or higher)
npm

Installation

Clone the repository:

git clone https://github.com/slattware/hng13-stage0-backend.git
cd string-analyzer-service


Install dependencies:

npm install

Dependencies

fastify: ^4.0.0
crypto: Node.js built-in module

Running Locally

Start the server:

npm start

The server will run on http://localhost:3000 by default.
Environment Variables

PORT: Port number for the server (default: 3000)

API Documentation
POST /strings
Analyze and store a new string.

Body: { "value": "string to analyze" }
Success: 201 Created
Errors: 400, 409, 422

GET /strings/:value
Retrieve a specific string by value.

Success: 200 OK
Error: 404

GET /strings
Get all strings with optional filters.

Query params: is_palindrome, min_length, max_length, word_count, contains_character
Success: 200 OK
Error: 400

GET /strings/filter-by-natural-language
Filter strings using natural language queries.

Query param: query
Success: 200 OK
Errors: 400, 422

DELETE /strings/:value
Delete a specific string.

Success: 204 No Content
Error: 404

Testing
Test endpoints using tools like Postman or curl. Example:
curl -X POST http://localhost:3000/strings -H "Content-Type: application/json" -d '{"value": "hello world"}'

Notes

Uses in-memory storage (Map) for simplicity
SHA-256 hashing for unique string identification
Case-insensitive palindrome checking
Basic natural language query parsing