# Analytics Dashboard - Quick Reference Guide

## API Endpoints

### New Endpoints (Add to tests)
```bash
# Average Resolution Time
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/analytics/avg-resolution-time

# Support Staff Performance
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/analytics/support-staff-performance

# SLA Breach Rate
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/analytics/sla-breach-rate

# Category Trends
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/analytics/category-trends
```

## Frontend API Calls

```javascript
// In React component
import { analyticsAPI } from '../services/api';

// Get all metrics in parallel
const [resTime, staff, sla, trends] = await Promise.all([
  analyticsAPI.getAvgResolutionTime(),
  analyticsAPI.getStaffPerformance(),
  analyticsAPI.getSLABreachRate(),
  analyticsAPI.getCategoryTrends()
]);
```

## Chart Data Structures

### Staff Performance Data
```javascript
{
  labels: ['John', 'Sarah', 'Mike'],
  datasets: [
    {
      label: 'Resolved',
      data: [18, 16, 14],
      backgroundColor: '#10b981'
    },
    {
      label: 'In Progress',
      data: [3, 5, 2],
      backgroundColor: '#f59e0b'
    }
  ]
}
```

### Category Trends Data
```javascript
{
  labels: ['Mar 17', 'Mar 18', 'Mar 19', ...],
  datasets: [
    {
      label: 'Technical',
      data: [2, 3, 1, ...],
      borderColor: '#7c3aed'
    },
    {
      label: 'Billing',
      data: [1, 2, 2, ...],
      borderColor: '#a855f7'
    }
  ]
}
```

## Component Structure

```
Analytics.js (Main Component)
├─ State: 10 metrics
├─ useEffect: Fetch all data
├─ JSX Sections:
│  ├─ Header + Refresh button
│  ├─ KPI Cards Row 1 (6 cards)
│  ├─ KPI Cards Row 2 (4 new cards) ← NEW
│  ├─ Charts Row 1 (Category + Status)
│  ├─ Charts Row 2 (Trend)
│  ├─ Charts Row 3 (Priority + Ratings)
│  ├─ Staff Performance Section ← NEW
│  │  ├─ Bar Chart
│  │  └─ Staff Details Table
│  ├─ Category Trends Section ← NEW
│  │  └─ Multi-line Chart
│  └─ SLA Analysis Section ← NEW
│     ├─ Breach Progress Bars
│     └─ Resolution Table
└─ CSS Classes: .analytics-*
```

## Color Reference

```javascript
const PRIORITY_COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#f59e0b',
  Low: '#06b6d4'
};

const STATUS_COLORS = {
  OPEN: '#06b6d4',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#10b981',
  CLOSED: '#22c55e'
};

const CATEGORY_COLORS = [
  '#7c3aed', '#a855f7', '#ec4899', '#06b6d4', '#10b981'
];
```

## CSS Class Hierarchy

```
.analytics-page
├─ .analytics-header
├─ .analytics-kpi-grid
│  ├─ .analytics-stat-card
│  ├─ .analytics-stat-icon
│  ├─ .analytics-stat-value
│  ├─ .analytics-stat-label
│  └─ .analytics-stat-sub
├─ .analytics-charts-row
│  └─ .analytics-chart-card
│     ├─ .analytics-chart-card--sm (smaller)
│     └─ .analytics-chart-card--wide (full width)
├─ .staff-details
│  ├─ .staff-item
│  ├─ .staff-info
│  ├─ .staff-name
│  ├─ .staff-email
│  ├─ .staff-stats
│  └─ .stat
├─ .sla-breakdown
│  ├─ .sla-item
│  ├─ .sla-header
│  ├─ .priority-badge
│  ├─ .sla-bar
│  └─ .sla-details
└─ .resolution-breakdown
   ├─ .resolution-item
   ├─ .resolution-header
   └─ .resolution-time
```

## MongoDB Aggregation Patterns

### Average Calculation
```javascript
const result = await Complaint.find({ status: { $in: ['RESOLVED', 'CLOSED'] } });
const avgHours = result.reduce((sum, c) => 
  sum + ((c.closedAt - c.createdAt) / 3600000), 0) / result.length;
```

### Group and Count
```javascript
await Complaint.aggregate([
  { $match: { assignedTo: { $exists: true } } },
  { $group: { 
      _id: '$assignedTo',
      count: { $sum: 1 }
    }
  }
])
```

### Time Series
```javascript
await Complaint.aggregate([
  { $match: { createdAt: { $gte: thirtyDaysAgo } } },
  { $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      count: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
])
```

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Unauthorized" | No JWT token | Add Authorization header |
| "Forbidden" | Not SUPPORT/ADMIN role | Check user role in database |
| "No data" | Empty database | Seed with sample complaints |
| Chart undefined | Missing Chart.js import | Check ChartJS.register() |
| Slow response | Large dataset | Add MongoDB indexes |

## Performance Tips

1. **Cache Results**: Store in React state for 5 minutes
2. **Lazy Load**: Only fetch when tab is visible
3. **Pagination**: For large staff lists, paginate
4. **Debounce**: Refresh button (prevent rapid clicks)
5. **Optimize Queries**: Use aggregation pipeline

## Testing Checklist

```javascript
// Test each endpoint
test('avg-resolution-time returns correct format', async () => {
  const res = await api.get('/analytics/avg-resolution-time');
  expect(res.data).toHaveProperty('avgResolutionTimeHours');
  expect(res.data).toHaveProperty('breakdown.byPriority');
});

// Test frontend integration
test('Analytics component fetches all metrics', async () => {
  render(<Analytics />);
  await waitFor(() => {
    expect(screen.getByText('Average Resolution Time')).toBeInTheDocument();
  });
});
```

## Environment Variables

```bash
# .env
REACT_APP_API_URL=http://localhost:5000/api
NODE_ENV=development
```

## Build Commands

```bash
# Development
npm start                    # Start React dev server
npm run server              # Start Express server

# Production
npm run build               # Build React bundle
npm run server:prod         # Start Express in production

# Testing
npm test                    # Run tests
npm run test:analytics      # Run analytics tests only
```

## Browser DevTools Tips

```javascript
// In Console
// Check auth token
sessionStorage.getItem('token')

// Test API call
fetch('/api/analytics/avg-resolution-time', {
  headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
}).then(r => r.json()).then(console.log)

// Check component state
$r.state // React DevTools extension

// Monitor network tab for API calls
// Look for 4 new endpoints with 2xx status
```

## Documentation Links

| Document | Purpose |
|----------|---------|
| `ANALYTICS_UPGRADE_DOCUMENTATION.md` | Complete technical details |
| `ANALYTICS_IMPLEMENTATION_SUMMARY.md` | High-level overview |
| `ANALYTICS_DASHBOARD_VISUAL.txt` | ASCII art layout |
| This file | Quick reference |

## Support Contacts

- Backend issues → Check `server/routes/analytics.js`
- Frontend issues → Check `client/src/pages/Analytics.js`
- Styling issues → Check `client/src/pages/Analytics.css`
- API issues → Check `client/src/services/api.js`

## Version History

```
v1.0.0 - Initial implementation
├─ 4 new API endpoints
├─ Enhanced React component
├─ 5 new visualizations
└─ Complete documentation
```

## Next Steps

1. ✅ Test all endpoints with curl/Postman
2. ✅ Verify dashboard displays correctly
3. ✅ Load test with large dataset
4. ✅ Deploy to staging
5. ✅ Deploy to production
6. ⏳ Implement Phase 2 features (date range picker, etc.)

## Quick Deployment

```bash
# 1. Backend
cd server
node -c routes/analytics.js  # Syntax check
npm start                    # Run

# 2. Frontend
cd client
npm run build               # Build
npm start                   # Test

# 3. Verify
curl http://localhost:5000/api/analytics/avg-resolution-time \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Last Updated**: April 16, 2026
**Status**: ✅ Production Ready
**Maintenance**: Low (static endpoints)
