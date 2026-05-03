/**
 * Priority Detection - Test Examples
 * 
 * Run this file to see intelligent priority detection in action:
 * node test-priority-detection.js
 */

const { detectPriority, analyzePriorityDetailed, getKeywordPatterns } = require('./server/utils/priorityDetector');

console.log('\n' + '='.repeat(80));
console.log('INTELLIGENT PRIORITY DETECTION - EXAMPLES');
console.log('='.repeat(80) + '\n');

// Test cases
const testCases = [
    {
        name: 'Critical System Failure',
        title: 'Website is down',
        description: 'The website crashed and is not working. The server appears to be offline.'
    },
    {
        name: 'Performance Issue',
        title: 'Dashboard loading very slow',
        description: 'The dashboard is extremely slow to load, taking 30+ seconds. The interface is also sluggish.'
    },
    {
        name: 'Delayed Feature',
        title: 'Report generation delay',
        description: 'The monthly report generation is taking longer than usual. It was delayed yesterday too.'
    },
    {
        name: 'General Inquiry',
        title: 'How to reset password',
        description: 'I need help resetting my password. I forgot it and can\'t log in.'
    },
    {
        name: 'Urgent Feature',
        title: 'Critical billing issue',
        description: 'Our billing system is showing incorrect amounts. This is urgent and needs immediate attention.'
    },
    {
        name: 'Minor Bug',
        title: 'Button color mismatch',
        description: 'The submit button color doesn\'t match the design specs.'
    },
    {
        name: 'System Outage',
        title: 'API is down',
        description: 'The API endpoint has completely stopped responding. All requests are failing with connection errors.'
    }
];

// Run tests
testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}`);
    console.log('-'.repeat(70));
    console.log(`   Title: "${testCase.title}"`);
    console.log(`   Description: "${testCase.description}"`);

    const detection = detectPriority(testCase.title, testCase.description);

    console.log(`\n   RESULT:`);
    console.log(`   ├─ Priority: ${detection.priority}`);
    console.log(`   ├─ Method: ${detection.detectedFrom}`);
    console.log(`   ├─ Confidence: ${(detection.confidence * 100).toFixed(1)}%`);
    console.log(`   ├─ Keywords: ${detection.keywords.length > 0 ? detection.keywords.join(', ') : 'none'}`);
    console.log(`   └─ Note: ${detection.note}`);
});

// Show keyword patterns
console.log('\n\n' + '='.repeat(80));
console.log('KEYWORD PATTERNS');
console.log('='.repeat(80) + '\n');

const patterns = getKeywordPatterns();
Object.entries(patterns).forEach(([priority, data]) => {
    console.log(`\n${priority} Priority:`);
    console.log(`  Description: ${data.description}`);
    if (data.keywords.length > 0) {
        console.log(`  Keywords: ${data.keywords.join(', ')}`);
    } else {
        console.log(`  Keywords: (default - no specific keywords)`);
    }
});

// Show detailed analysis for one example
console.log('\n\n' + '='.repeat(80));
console.log('DETAILED ANALYSIS EXAMPLE');
console.log('='.repeat(80) + '\n');

const detailedAnalysis = analyzePriorityDetailed(
    'Website is completely broken and not working',
    'The entire website is down and throwing critical errors. Users cannot access anything.'
);

console.log('Input:');
console.log(`  Title: "${detailedAnalysis.text.title}"`);
console.log(`  Description: "${detailedAnalysis.text.description}"`);

console.log('\nKeyword Score Breakdown:');
console.log(`  HIGH Priority:`);
console.log(`    - Keywords found: ${detailedAnalysis.scores.HIGH.keywords.join(', ') || 'none'}`);
console.log(`    - Total matches: ${detailedAnalysis.scores.HIGH.count}`);

console.log(`  MEDIUM Priority:`);
console.log(`    - Keywords found: ${detailedAnalysis.scores.MEDIUM.keywords.join(', ') || 'none'}`);
console.log(`    - Total matches: ${detailedAnalysis.scores.MEDIUM.count}`);

console.log(`\nDetection Result:`);
console.log(`  Priority: ${detailedAnalysis.result.priority}`);
console.log(`  Confidence: ${(detailedAnalysis.result.confidence * 100).toFixed(1)}%`);
console.log(`  Matched Keywords: ${detailedAnalysis.result.keywords.join(', ')}`);

console.log('\n' + '='.repeat(80) + '\n');
