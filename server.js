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

// Define the response schema
const responseSchema = {
    type: 'object',
    properties: {
        status: { type: 'string', enum: ['success']},
        user: {
            type: "object",
            required: ['email', 'name', 'stack'],
            properties: {
                email: {
                    type: 'string',
                    format: 'email'
                },
                name: {
                    type: 'string'
                },
                stack: {
                    type: 'string'
                }
            },
            additionalProperties: false
        },
        timestamp: {
            type: 'string',
            format: 'date-time'
        },
        fact: {'type': 'string'}
    },
    required: ['status', 'user', 'timestamp', 'fact']
};

const user = {
    email: process.env.USER_EMAIL,
    name: process.env.USER_NAME,
    stack: process.env.USER_STACK
}

// Define the API route with schema validation
fastify.get('/me', {
    schema: {
        response: {
            200: responseSchema
        }
    }
}, async (request, reply) => {
    try {
        // Prepare the response data object
            const responseData = {
        };

        const now = new Date().toISOString();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch("https:/catfact.ninja/fact", {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId); 

         if (!response.ok) {
             throw new Error('Cat API is not working');
         }
         const catFactData = await response.json();
         responseData.fact = catFactData.fact;
         responseData.user = user;
         responseData.status = "success";
         responseData.timestamp = now;

        // Set the response type to JSON
        reply.type('application/json');
        // Send the response
        return responseData;
    } catch (error) {
        // Log the error for debugging
        fastify.log.error(error);
        if ( error.name = "Abort Error" ) {
            fastify.log.warn('Cats API is not working')
        }
        if (error.message === 'nil') {
            // Respond with 400
            return reply.status(400).send({
                number: '',
                error: true
            });
        }
        else if ( error.message ) {
            // Respond with 400
            return reply.status(400).send({
                number: error.message,
                error: true
            });
        }
        else {
            // Respond with 500
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred while processing your request.'
            });
        }
    }
});

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