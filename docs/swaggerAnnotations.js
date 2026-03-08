/**
 * Swagger/OpenAPI annotations for Welfare Scheme API
 * See http://localhost:3000/api-docs when server is running
 */

/* eslint-disable no-unused-vars */

// Base paths - JSDoc for swagger-jsdoc
/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: API health check
 *     responses:
 *       200:
 *         description: API and database status
 */
void 0;

/**
 * @openapi
 * /api/admin-login:
 *   post:
 *     tags: [Auth]
 *     summary: Admin login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: "super.admin" }
 *               password: { type: string, example: "Admin@123" }
 *     responses:
 *       200:
 *         description: Returns token and user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: "success" }
 *                 token: { type: string, description: "JWT for Authorization header" }
 *                 user: { type: object }
 *       401:
 *         description: Invalid credentials
 */
void 0;

/**
 * @openapi
 * /api/ads/public:
 *   get:
 *     tags: [Ads]
 *     summary: Get active ads (public, no auth)
 *     responses:
 *       200:
 *         description: Array of active ads
 */
void 0;

/**
 * @openapi
 * /api/ads:
 *   get:
 *     tags: [Ads]
 *     summary: List all ads (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: All ads
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags: [Ads]
 *     summary: Create ad (Super Admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *               link: { type: string }
 *               image_url: { type: string }
 *               order: { type: integer }
 *               active: { type: boolean }
 *     responses:
 *       201:
 *         description: Created
 */
void 0;

/**
 * @openapi
 * /api/ads/{id}:
 *   put:
 *     tags: [Ads]
 *     summary: Update ad
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated ad
 *       404:
 *         description: Ad not found
 *   delete:
 *     tags: [Ads]
 *     summary: Delete ad
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Ad not found
 */
void 0;

/**
 * @openapi
 * /api/schemes:
 *   get:
 *     tags: [Schemes]
 *     summary: List schemes (public)
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema: { type: string }
 *       - in: query
 *         name: age_group
 *         schema: { type: string, example: "20-30" }
 *     responses:
 *       200:
 *         description: List of schemes
 */
void 0;

/**
 * @openapi
 * /api/schemes/{id}:
 *   get:
 *     tags: [Schemes]
 *     summary: Get single scheme by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Scheme details
 *       404:
 *         description: Scheme not found
 */
void 0;

/**
 * @openapi
 * /api/applications/apply:
 *   post:
 *     tags: [Applications]
 *     summary: Apply to a scheme (public, verified users only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, scheme_id]
 *             properties:
 *               user_id: { type: string }
 *               scheme_id: { type: string }
 *               form_data: { type: object }
 *               documents_submitted: { type: array }
 *     responses:
 *       201:
 *         description: Application created
 *       400:
 *         description: Already applied / not eligible
 *       403:
 *         description: User not verified
 */
void 0;

/**
 * @openapi
 * /api/admin/dashboard/statistics:
 *   get:
 *     tags: [Admin Dashboard]
 *     summary: Dashboard statistics
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Stats (totalApplicants, approved, pending, rejected)
 */
void 0;

/**
 * @openapi
 * /api/admin/dashboard/fraud-alerts:
 *   get:
 *     tags: [Admin Dashboard]
 *     summary: Fraud alerts (duplicate/ineligible)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [all, duplicate, ineligible] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of fraud alerts
 */
void 0;
