# Country Currency & Exchange API

## Description
RESTful API that fetches, caches, and manages country data with exchange rates and estimated GDP.

## Setup Instructions
1. Clone the repo: `git clone https://github.com/slattware/hng13-stage0-backend.git`
2. Install dependencies: `npm install`
3. Create `.env` file with:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=yourdbname
PORT=3000

4. Create the MySQL database if it doesn't exist.
5. Run locally: `node server.js`

## Running Locally
- Start the server: `node server.js`
- Test endpoints with Postman or curl (e.g., POST http://localhost:3000/countries/refresh)

## Dependencies
- express: API framework
- mysql2: MySQL driver
- dotenv: Environment variables
- axios: HTTP client
- jimp: Image generation

Install: `npm install express mysql2 dotenv axios jimp`

## Environment Variables
- DB_HOST: MySQL host
- DB_USER: MySQL user
- DB_PASSWORD: MySQL password
- DB_NAME: MySQL database name
- PORT: Server port (default 3000)

## API Documentation
- POST /countries/refresh: Refresh data
- GET /countries?region=Africa&currency=NGN&sort=gdp_desc: List countries
- GET /countries/:name: Get country
- DELETE /countries/:name: Delete country
- GET /status: Status
- GET /countries/image: Summary image

## Tests/Notes
- Test refresh first to populate DB.
- Image generates after refresh.
- Host on platforms like Railway, Heroku, AWS (not Vercel/Render).
- GitHub Repo: https://github.com/slattware/hng13-stage0-backend
