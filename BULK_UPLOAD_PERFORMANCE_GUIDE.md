# Bulk Upload Performance & Scalability Guide

## Current Limitations

### File Size Limit
- **Maximum file size**: 10MB (configured in multer)
- **Location**: `routes/bulkUpload.js` line 55
- **Current setting**: `fileSize: 10 * 1024 * 1024`

### Processing Approach
- **Synchronous processing**: Rows are processed one by one in a loop
- **Database operations**: Each row performs multiple database queries:
  - Find user by Aadhaar
  - Check for existing application
  - Check excluded schemes (multiple queries)
  - Create user (if new)
  - Create application
- **No batching**: All operations are individual database calls

### Estimated Capacity

Based on current implementation:

| Rows | Estimated Time | Notes |
|------|----------------|-------|
| 100 rows | ~5-10 seconds | Small files, manageable |
| 500 rows | ~25-50 seconds | Medium files, acceptable |
| 1,000 rows | ~50-100 seconds | Large files, may timeout |
| 2,000+ rows | **Likely timeout** | Very large files, not recommended |

**Note**: These estimates assume:
- Average of 2-3 database queries per row
- Network latency to MongoDB
- No heavy excluded scheme checks

### Timeout Risks

**Default Express/Node.js timeouts:**
- **No explicit timeout set** in current server.js
- **Default Node.js timeout**: Usually 2 minutes (120 seconds) for HTTP requests
- **Browser timeout**: Varies (typically 30 seconds to 2 minutes)

**Risk factors:**
1. **Large files** (>1000 rows) may exceed timeout
2. **Complex excluded scheme checks** (multiple schemes) increase processing time
3. **Database latency** can slow down operations
4. **Synchronous processing** blocks the event loop

## Recommendations

### For Current Implementation

**Safe limits:**
- **Recommended**: Up to **500 rows** per upload
- **Maximum**: Up to **1,000 rows** (may timeout)
- **Not recommended**: More than 1,000 rows

**Best practices:**
1. **Split large files**: Break files into batches of 500 rows
2. **Monitor processing**: Show progress indicators
3. **Handle timeouts**: Implement proper error handling
4. **Test with sample data**: Test with realistic data volumes

### Performance Optimization Options

#### Option 1: Increase File Size Limit (Quick Fix)

```javascript
// routes/bulkUpload.js
limits: {
  fileSize: 50 * 1024 * 1024, // Increase to 50MB
},
```

**Pros**: Allows larger files
**Cons**: Still processes synchronously, may still timeout

#### Option 2: Add Request Timeout (Quick Fix)

```javascript
// server.js
app.use('/api/bulk-upload', (req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);
  next();
});
```

**Pros**: Prevents premature timeouts
**Cons**: Long-running requests may still fail

#### Option 3: Batch Processing (Recommended)

Process rows in batches instead of one-by-one:

```javascript
// Process in batches of 50
const BATCH_SIZE = 50;
for (let i = 0; i < parsedData.length; i += BATCH_SIZE) {
  const batch = parsedData.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(row => processRow(row)));
}
```

**Pros**: Faster processing, better resource usage
**Cons**: Requires code refactoring

#### Option 4: Background Job Processing (Best for Production)

Move processing to background jobs:

```javascript
// Queue the job
const job = await jobQueue.add('bulk-upload', {
  file_path: req.file.path,
  scheme_id: scheme_id,
});

// Return job ID immediately
res.json({ status: 'queued', job_id: job.id });
```

**Pros**: 
- No timeout issues
- Better scalability
- Can handle thousands of rows
- User gets immediate response

**Cons**: 
- Requires job queue system (Bull, BullMQ, etc.)
- More complex implementation
- Need to track job status

#### Option 5: Streaming Processing (Advanced)

Process file as it's being read:

```javascript
// Stream CSV/Excel processing
const stream = fs.createReadStream(filePath);
// Process row by row as streamed
```

**Pros**: Memory efficient, can handle very large files
**Cons**: Complex implementation, requires streaming libraries

## Current Implementation Analysis

### Processing Flow

```
For each row:
  1. Parse row data (fast)
  2. Validate data (fast)
  3. Check duplicate in file (fast - in-memory)
  4. Find user by Aadhaar (DB query - ~10-50ms)
  5. Check existing application (DB query - ~10-50ms)
  6. Check excluded schemes (DB queries - ~50-200ms if multiple)
  7. Create/update user (DB write - ~20-100ms)
  8. Create application (DB write - ~20-100ms)

Total per row: ~110-500ms (depending on excluded scheme checks)
```

### Bottlenecks

1. **Database queries**: Multiple queries per row
2. **Excluded scheme checks**: Can be slow if many excluded schemes
3. **Synchronous processing**: Blocks event loop
4. **No connection pooling optimization**: May create many connections

## Testing Recommendations

### Test Scenarios

1. **Small file** (50 rows): Should complete in <5 seconds
2. **Medium file** (500 rows): Should complete in <60 seconds
3. **Large file** (1,000 rows): May timeout, test carefully
4. **Very large file** (2,000+ rows): Will likely timeout

### Monitoring

Add logging to track performance:

```javascript
const startTime = Date.now();
// ... processing ...
const endTime = Date.now();
console.log(`Processed ${rows.length} rows in ${endTime - startTime}ms`);
```

## Immediate Actions

### For Production Use

1. **Set explicit timeout**:
   ```javascript
   // server.js
   app.use('/api/bulk-upload', (req, res, next) => {
     req.setTimeout(300000); // 5 minutes
     res.setTimeout(300000);
     next();
   });
   ```

2. **Increase file size limit** (if needed):
   ```javascript
   // routes/bulkUpload.js
   limits: {
     fileSize: 50 * 1024 * 1024, // 50MB
   },
   ```

3. **Add progress tracking** (for frontend):
   - Return progress updates during processing
   - Use WebSockets or polling for status

4. **Implement error recovery**:
   - Save progress periodically
   - Allow resuming failed uploads

### For Large-Scale Use

Consider implementing:
- **Background job processing** (Bull/BullMQ)
- **Batch processing** (process in chunks)
- **Database optimization** (indexes, bulk operations)
- **Caching** (cache scheme exclusion data)

## Example: Calculating Capacity

**Assumptions:**
- Average processing time: 200ms per row
- Timeout limit: 120 seconds (2 minutes)
- Safety margin: 80% of timeout (96 seconds)

**Calculation:**
```
Max rows = (96 seconds * 1000ms) / 200ms per row
Max rows = 96,000ms / 200ms
Max rows = 480 rows
```

**Recommendation**: Keep uploads under **500 rows** for safety.

## Summary

| Metric | Current Value | Recommended |
|--------|--------------|-------------|
| File size limit | 10MB | 50MB (if needed) |
| Max rows (safe) | ~500 | 500 |
| Max rows (risky) | ~1,000 | 1,000+ (with optimization) |
| Request timeout | Default (120s) | 300s (5 min) |
| Processing method | Synchronous | Background jobs (production) |

**Current capacity**: **~500 rows per upload** is safe and reliable.
