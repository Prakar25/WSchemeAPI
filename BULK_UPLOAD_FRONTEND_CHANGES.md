# Frontend Changes Required for Excluded Scheme Conflict

## Summary

**Minimal changes needed** - The existing redundancy handling code will work, but you should update the type badge display to include the new `excluded_scheme_conflict` type.

## Required Changes

### 1. Update Redundancy Type Badge Display

In your redundancy table, update the type badge logic to handle the new `excluded_scheme_conflict` type:

**Current code (if you have it):**
```jsx
<span className={`px-2 py-1 rounded text-xs ${
  redundancy.type === 'duplicate_in_file' 
    ? 'bg-orange-100 text-orange-800' 
    : 'bg-red-100 text-red-800'
}`}>
  {redundancy.type === 'duplicate_in_file' ? 'Duplicate in File' : 'Existing Application'}
</span>
```

**Updated code:**
```jsx
<span className={`px-2 py-1 rounded text-xs ${
  redundancy.type === 'duplicate_in_file' 
    ? 'bg-orange-100 text-orange-800' 
    : redundancy.type === 'excluded_scheme_conflict'
    ? 'bg-red-100 text-red-800'
    : 'bg-yellow-100 text-yellow-800'
}`}>
  {redundancy.type === 'duplicate_in_file' 
    ? 'Duplicate in File' 
    : redundancy.type === 'excluded_scheme_conflict'
    ? 'Scheme Conflict'
    : 'Existing Application'}
</span>
```

### 2. Optional: Display Conflicting Schemes

If you want to show which schemes are conflicting, you can access `redundancy.conflictingSchemes`:

```jsx
{redundancy.type === 'excluded_scheme_conflict' && redundancy.conflictingSchemes && (
  <div className="mt-1 text-xs text-gray-600">
    Conflicts with: {redundancy.conflictingSchemes.map(s => s.scheme_name).join(', ')}
  </div>
)}
```

## Redundancy Types Reference

| Type | Badge Color | Badge Text | Description |
|------|-------------|------------|-------------|
| `duplicate_in_file` | Orange | "Duplicate in File" | Same Aadhaar appears multiple times in upload |
| `existing_application` | Yellow | "Existing Application" | User already has application for this scheme |
| `excluded_scheme_conflict` | Red | "Scheme Conflict" | User enrolled in incompatible scheme(s) |

## API Response Structure

The API now returns redundancies with the new type:

```json
{
  "redundancies": [
    {
      "row": 25,
      "aadhaarNumber": "223344556677",
      "fullName": "Alice Williams",
      "error": "Scheme conflict: This user is already enrolled in incompatible scheme(s): Youth Scheme. Cannot avail this scheme.",
      "type": "excluded_scheme_conflict",
      "conflictingSchemes": [
        {
          "_id": "696548bd9860664c364e628b",
          "scheme_name": "Youth Scheme"
        }
      ]
    }
  ]
}
```

## What Already Works

✅ **No changes needed for:**
- Redundancy table display (will show all types)
- Error messages (already displayed)
- Statistics cards (already count redundancies)
- Warning alerts (already shown)

✅ **The existing code handles:**
- Displaying redundancy count
- Showing redundancy rows in table
- Error messages with details

## Testing Checklist

- [ ] Redundancy table displays all three types correctly
- [ ] Type badges show correct colors and text
- [ ] Error messages display correctly for excluded scheme conflicts
- [ ] Conflicting scheme names are shown (if implemented)
- [ ] Statistics count includes excluded scheme conflicts

## Example: Complete Redundancy Row Display

```jsx
{previewData.redundancies.map((redundancy, index) => (
  <tr key={index}>
    <td className="px-4 py-3 text-sm text-gray-900">{redundancy.row}</td>
    <td className="px-4 py-3 text-sm text-gray-900">{redundancy.fullName}</td>
    <td className="px-4 py-3 text-sm text-gray-900">
      {maskAadhaar(redundancy.aadhaarNumber)}
    </td>
    <td className="px-4 py-3 text-sm">
      <span className={`px-2 py-1 rounded text-xs ${
        redundancy.type === 'duplicate_in_file' 
          ? 'bg-orange-100 text-orange-800' 
          : redundancy.type === 'excluded_scheme_conflict'
          ? 'bg-red-100 text-red-800'
          : 'bg-yellow-100 text-yellow-800'
      }`}>
        {redundancy.type === 'duplicate_in_file' 
          ? 'Duplicate in File' 
          : redundancy.type === 'excluded_scheme_conflict'
          ? 'Scheme Conflict'
          : 'Existing Application'}
      </span>
      {redundancy.type === 'excluded_scheme_conflict' && redundancy.conflictingSchemes && (
        <div className="mt-1 text-xs text-gray-600">
          Conflicts: {redundancy.conflictingSchemes.map(s => s.scheme_name).join(', ')}
        </div>
      )}
    </td>
    <td className="px-4 py-3 text-sm text-orange-600">{redundancy.error}</td>
  </tr>
))}
```

## Summary

**Minimal frontend changes required:**
1. Update type badge logic to include `excluded_scheme_conflict` (1-2 lines of code)
2. Optional: Display conflicting schemes for better UX

**Everything else already works** - the API response structure is compatible with existing code.
