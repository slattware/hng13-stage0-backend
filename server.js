// index.js
// import { Jimp } from "jimp";
const express = require('express');
const mysql = require('mysql2/promise'); // Using promise version for async/await
const dotenv = require('dotenv');
const axios = require('axios');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(express.json());

// Create cache directory if it doesn't exist
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Initialize database table on startup
(async () => {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS countries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        capital VARCHAR(255),
        region VARCHAR(255),
        population BIGINT NOT NULL,
        currency_code VARCHAR(3),
        exchange_rate DECIMAL(15,4),
        estimated_gdp DECIMAL(20,2),
        flag_url VARCHAR(255),
        last_refreshed_at DATETIME
      )
    `;
    await pool.query(createTableQuery);
    console.log('Database table initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
})();

// GET /countries/image - Serve summary image
app.get('/countries/image', (req, res) => {
  const imagePath = path.join(cacheDir, 'summary.png');
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).json({ error: 'Summary image not found' });
  }
});

// POST /countries/refresh - Fetch and cache countries
app.post('/countries/refresh', async (req, res) => {
  try {
    // Fetch countries data
    let countriesResponse;
    try {
      countriesResponse = await axios.get('https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies');
    } catch (err) {
      return res.status(503).json({
        error: 'External data source unavailable',
        details: 'Could not fetch data from Countries API'
      });
    }

    // Fetch exchange rates
    let exchangeResponse;
    try {
      exchangeResponse = await axios.get('https://open.er-api.com/v6/latest/USD');
    } catch (err) {
      return res.status(503).json({
        error: 'External data source unavailable' + err,
        details: 'Could not fetch data from Exchange Rates API'
      });
    }

    const countries = countriesResponse.data;
    const rates = exchangeResponse.data.rates;

    for (const country of countries) {
      // Validation: Skip if required fields missing
      if (!country.name || typeof country.population !== 'number') {
        console.warn(`Skipping invalid country data: ${country.name || 'Unknown'}`);
        continue;
      }

      let currency_code = country.currencies?.[0]?.code || null;
      let exchange_rate = null;
      if (currency_code && rates[currency_code]) {
        exchange_rate = rates[currency_code];
      }

      const randomMultiplier = Math.random() * 1000 + 1000;
      let estimated_gdp = null;
      if (exchange_rate !== null && currency_code !== null) {
        estimated_gdp = (country.population * randomMultiplier) / exchange_rate;
      } else if (currency_code === null) {
        estimated_gdp = 0;
      }

      const capital = country.capital || null;
      const region = country.region || null;
      const flag_url = country.flag || null;

      // Check if country exists (case-insensitive)
      const [existingRows] = await pool.query(
        'SELECT id FROM countries WHERE LOWER(name) = LOWER(?)',
        [country.name]
      );

      if (existingRows.length > 0) {
        // Update existing record
        const id = existingRows[0].id;
        await pool.query(
          `UPDATE countries SET 
            capital = ?, 
            region = ?, 
            population = ?, 
            currency_code = ?, 
            exchange_rate = ?, 
            estimated_gdp = ?, 
            flag_url = ?, 
            last_refreshed_at = NOW() 
          WHERE id = ?`,
          [capital, region, country.population, currency_code, exchange_rate, estimated_gdp, flag_url, id]
        );
      } else {
        // Insert new record
        await pool.query(
          `INSERT INTO countries (
            name, capital, region, population, currency_code, 
            exchange_rate, estimated_gdp, flag_url, last_refreshed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [country.name, capital, region, country.population, currency_code, exchange_rate, estimated_gdp, flag_url]
        );
      }
    }

    // Generate summary image after successful refresh
    await generateSummaryImage();

    res.status(200).json({ message: 'Refresh successful' });
  } catch (err) {
    console.error('Error during refresh:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to generate summary image
async function generateSummaryImage() {
  try {
    const [[totalRow]] = await pool.query('SELECT COUNT(*) as total_countries FROM countries');
    const total = totalRow.total_countries;

    const [[lastRefreshRow]] = await pool.query('SELECT MAX(last_refreshed_at) as last_refreshed_at FROM countries');
    const lastRefresh = lastRefreshRow.last_refreshed_at ? lastRefreshRow.last_refreshed_at.toISOString() : 'N/A';

    const [top5Rows] = await pool.query(
      'SELECT name, estimated_gdp FROM countries WHERE estimated_gdp IS NOT NULL ORDER BY estimated_gdp DESC LIMIT 5'
    );

    // Create image
    const width = 800;
    const height = 600;
    const image = new Jimp(width, height, 0xffffffff); // White background

    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

    // Add text
    image.print(font, 50, 50, `Total Countries: ${total}`);
    image.print(font, 50, 100, `Last Refresh: ${lastRefresh}`);
    image.print(font, 50, 150, 'Top 5 Countries by Estimated GDP:');

    top5Rows.forEach((row, index) => {
      image.print(font, 50, 200 + index * 50, `${index + 1}. ${row.name}: ${row.estimated_gdp.toFixed(2)}`);
    });

    // Save image
    await image.writeAsync(path.join(cacheDir, 'summary.png'));
  } catch (err) {
    console.error('Error generating summary image:', err);
  }
}

// GET /countries - List countries with filters and sorting
app.get('/countries', async (req, res) => {
  try {
    let sql = 'SELECT * FROM countries';
    const params = [];

    const whereClauses = [];
    if (req.query.region) {
      whereClauses.push('region = ?');
      params.push(req.query.region);
    }
    if (req.query.currency) {
      whereClauses.push('currency_code = ?');
      params.push(req.query.currency);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    if (req.query.sort === 'gdp_desc') {
      sql += ' ORDER BY estimated_gdp DESC';
    } else if (req.query.sort === 'gdp_asc') {
      sql += ' ORDER BY estimated_gdp ASC';
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching countries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /countries/:name - Get one country
app.get('/countries/:name', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM countries WHERE LOWER(name) = LOWER(?)',
      [req.params.name]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching country:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /countries/:name - Delete a country
app.delete('/countries/:name', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM countries WHERE LOWER(name) = LOWER(?)',
      [req.params.name]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }
    res.status(200).json({ message: 'Country deleted' });
  } catch (err) {
    console.error('Error deleting country:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /status - Show status
app.get('/status', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as total_countries, MAX(last_refreshed_at) as last_refreshed_at FROM countries'
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});