const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Welfare Scheme API",
      version: "1.0.0",
      description: "Backend API for welfare scheme management, applications, admin dashboard, and public services.",
    },
    servers: [
      { url: "http://localhost:3000", description: "Development" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Admin JWT from POST /api/admin-login",
        },
        adminHeaders: {
          type: "apiKey",
          in: "header",
          name: "x-admin-username",
          description: "Legacy: x-admin-username + x-admin-password",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            status: { type: "string", example: "error" },
            message: { type: "string" },
          },
        },
      },
    },
    tags: [
      { name: "Health", description: "Health checks" },
      { name: "Auth", description: "Admin login" },
      { name: "Schemes", description: "Welfare schemes" },
      { name: "Ads", description: "Home page ads" },
      { name: "Applications", description: "Scheme applications" },
      { name: "Admin Dashboard", description: "Admin dashboard endpoints" },
    ],
  },
  apis: [path.join(__dirname, "../docs/swaggerAnnotations.js")],
};

module.exports = swaggerJsdoc(options);
