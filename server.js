const crypto = require('crypto')
require('dotenv').config();

const fastify = require('fastify')({
    logger: {
        level: process.env.LOG_LEVEL || 'info', 
        // prettyPrint: process.env.NODE_ENV !== 'production'
    }
});
const fastifyCors = require('@fastify/cors');

// Register CORS
fastify.register(fastifyCors, {
    origin: '*',
});

// // Define the response schema
// const responseSchema = {
//     type: 'object',
//     properties: {
//         status: { type: 'string', enum: ['success']},
//         user: {
//             type: "object",
//             required: ['email', 'name', 'stack'],
//             properties: {
//                 email: {
//                     type: 'string',
//                     format: 'email'
//                 },
//                 name: {
//                     type: 'string'
//                 },
//                 stack: {
//                     type: 'string'
//                 }
//             },
//             additionalProperties: false
//         },
//         timestamp: {
//             type: 'string',
//             format: 'date-time'
//         },
//         fact: {'type': 'string'}
//     },
//     required: ['status', 'user', 'timestamp', 'fact']
// };

// const user = {
//     email: process.env.USER_EMAIL,
//     name: process.env.USER_NAME,
//     stack: process.env.USER_STACK
// }

// In-memory store for strings
const stringStore = new Map()

// Helper functions
function computeStringProperties(value) {
  const hash = crypto.createHash('sha256').update(value).digest('hex')
  const lowerValue = value.toLowerCase()
  const isPalindrome = lowerValue === lowerValue.split('').reverse().join('')
  const charFrequency = {}
  for (const char of value) {
    charFrequency[char] = (charFrequency[char] || 0) + 1
  }
  const uniqueChars = Object.keys(charFrequency).length
  const wordCount = value.trim().split(/\s+/).length

  return {
    length: value.length,
    is_palindrome: isPalindrome,
    unique_characters: uniqueChars,
    word_count: wordCount,
    sha256_hash: hash,
    character_frequency_map: charFrequency
  }
}

function parseNaturalLanguageQuery(query) {
  query = query.toLowerCase()
  const filters = {}

  if (query.includes('single word')) {
    filters.word_count = 1
  }
  if (query.includes('palindromic') || query.includes('palindrome')) {
    filters.is_palindrome = true
  }
  if (query.includes('longer than')) {
    const match = query.match(/longer than (\d+)/)
    if (match) filters.min_length = parseInt(match[1]) + 1
  }
  if (query.includes('contain') && query.includes('vowel')) {
    filters.contains_character = 'a'
  }
  if (query.includes('letter')) {
    const match = query.match(/letter (\w)/)
    if (match) filters.contains_character = match[1]
  }

  return filters
}

// Schema definitions
const stringSchema = {
  type: 'object',
  required: ['value'],
  properties: {
    value: { type: 'string' }
  }
}

const querySchema = {
  type: 'object',
  properties: {
    is_palindrome: { type: 'boolean' },
    min_length: { type: 'integer', minimum: 0 },
    max_length: { type: 'integer', minimum: 0 },
    word_count: { type: 'integer', minimum: 0 },
    contains_character: { type: 'string', maxLength: 1 }
  }
}

// Routes
fastify.post('/strings', {
  schema: {
    body: stringSchema,
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          value: { type: 'string' },
          properties: { type: 'object' },
          created_at: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
}, async (request, reply) => {
  const { value } = request.body
  if (!value || typeof value !== 'string') {
    return reply.code(422).send({ error: 'Invalid data type for "value" (must be string)' })
  }

  const properties = computeStringProperties(value)
  if (stringStore.has(properties.sha256_hash)) {
    return reply.code(409).send({ error: 'String already exists in the system' })
  }
  console.log(properties);

  const stringData = {
    id: properties.sha256_hash,
    value,
    properties,
    created_at: new Date().toISOString()
  }
  console.log('mil')
  console.log(properties)
  console.log(stringData)

  stringStore.set(properties.sha256_hash, stringData)
  console.log(stringData)
  return stringData;
})

fastify.get('/strings/:value', async (request, reply) => {
  const value = request.params.value
  const hash = crypto.createHash('sha256').update(value).digest('hex')
  
  const stringData = stringStore.get(hash)
  if (!stringData) {
    return reply.code(404).send({ error: 'String deos not exist in the system' })
  }

  return stringData
})

fastify.get('/strings', {
  schema: {
    querystring: querySchema
  }
}, async (request, reply) => {
  const { is_palindrome, min_length, max_length, word_count, contains_character } = request.query
  const filters = { is_palindrome, min_length, max_length, word_count, contains_character }

  if (Object.values(filters).some(val => val !== undefined)) {
    // Validate query parameters
    if (min_length && isNaN(min_length)) {
      return reply.code(400).send({ error: 'Invalid min_length' })
    }
    if (max_length && isNaN(max_length)) {
      return reply.code(400).send({ error: 'Invalid max_length' })
    }
    if (word_count && isNaN(word_count)) {
      return reply.code(400).send({ error: 'Invalid word_count' })
    }
    if (contains_character && contains_character.length !== 1) {
      return reply.code(400).send({ error: 'contains_character must be a single character' })
    }
  }

  const results = Array.from(stringStore.values()).filter(item => {
    const props = item.properties
    return (
      (is_palindrome === undefined || props.is_palindrome === is_palindrome) &&
      (min_length === undefined || props.length >= min_length) &&
      (max_length === undefined || props.length <= max_length) &&
      (word_count === undefined || props.word_count === word_count) &&
      (contains_character === undefined || item.value.includes(contains_character))
    )
  })

  return {
    data: results,
    count: results.length,
    filters_applied: filters
  }
})

fastify.get('/strings/filter-by-natural-language', async (request, reply) => {
  const { query } = request.query
  if (!query) {
    return reply.code(400).send({ error: 'Query parameter is required' })
  }

  try {
    const parsedFilters = parseNaturalLanguageQuery(query)
    if (Object.keys(parsedFilters).length === 0) {
      return reply.code(400).send({ error: 'Unable to parse natural language query' })
    }

    const results = Array.from(stringStore.values()).filter(item => {
      const props = item.properties
      return (
        (parsedFilters.is_palindrome === undefined || props.is_palindrome === parsedFilters.is_palindrome) &&
        (parsedFilters.min_length === undefined || props.length >= parsedFilters.min_length) &&
        (parsedFilters.word_count === undefined || props.word_count === parsedFilters.word_count) &&
        (parsedFilters.contains_character === undefined || item.value.includes(parsedFilters.contains_character))
      )
    })

    return {
      data: results,
      count: results.length,
      interpreted_query: {
        original: query,
        parsed_filters: parsedFilters
      }
    }
  } catch (error) {
    return reply.code(422).send({ error: 'Query parsed but resulted in conflicting filters' })
  }
})

fastify.delete('/strings/:value', async (request, reply) => {
  const value = request.params.value
  const hash = crypto.createHash('sha256').update(value).digest('hex')
  
  if (!stringStore.has(hash)) {
    return reply.code(404).send({ error: 'String does not exist in the system' })
  }

  stringStore.delete(hash)
  return reply.code(204).send()
})

// // Define the API route with schema validation
// fastify.get('/me', {
//     schema: {
//         response: {
//             200: responseSchema
//         }
//     }
// }, async (request, reply) => {
//     try {
//         // Prepare the response data object
//             const responseData = {
//         };

//         const now = new Date().toISOString();

//         const controller = new AbortController();
//         const timeoutId = setTimeout(() => controller.abort(), 5000);

//         const response = await fetch("https:/catfact.ninja/fact", {
//             signal: controller.signal
//         });
        
//         clearTimeout(timeoutId); 

//          if (!response.ok) {
//              throw new Error('Cat API is not working');
//          }
//          const catFactData = await response.json();
//          responseData.fact = catFactData.fact;
//          responseData.user = user;
//          responseData.status = "success";
//          responseData.timestamp = now;

//         // Set the response type to JSON
//         reply.type('application/json');
//         // Send the response
//         return responseData;
//     } catch (error) {
//         // Log the error for debugging
//         fastify.log.error(error);
//         if ( error.name = "Abort Error" ) {
//             fastify.log.warn('Cats API is not working')
//         }
//         if (error.message === 'nil') {
//             // Respond with 400
//             return reply.status(400).send({
//                 number: '',
//                 error: true
//             });
//         }
//         else if ( error.message ) {
//             // Respond with 400
//             return reply.status(400).send({
//                 number: error.message,
//                 error: true
//             });
//         }
//         else {
//             // Respond with 500
//             return reply.status(500).send({
//                 error: 'Internal Server Error',
//                 message: 'An unexpected error occurred while processing your request.'
//             });
//         }
//     }
// });

fastify.get('/', async(request, reply) => {
    return {status: 'API is running'};
})

// Set the port and host
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Start the server
const start = async () => {
    try {
        await fastify.listen({ host: '0.0.0.0', port: PORT });
        fastify.log.info(`Server listening on http://${HOST}:${PORT} in ${process.env.NODE_ENV} mode`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();