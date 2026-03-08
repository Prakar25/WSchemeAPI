# Swagger / OpenAPI

## Access

- **Interactive UI:** http://localhost:3000/api-docs
- **Raw JSON spec:** http://localhost:3000/api-docs.json

## Auth in Swagger UI

1. Call `POST /api/admin-login` with `username` and `password`
2. Copy the `token` from the response
3. Click **Authorize**
4. Enter: `Bearer <your-token>`
5. All subsequent requests will include the token

## Adding Endpoints

Edit `docs/swaggerAnnotations.js` and add `@openapi` JSDoc blocks. Follow the existing pattern.

## Tech Stack

- **swagger-jsdoc** – builds OpenAPI spec from JSDoc
- **swagger-ui-express** – serves Swagger UI
