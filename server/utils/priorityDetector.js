/**
 * Priority Detection Utility
 * 
 * Intelligently detects complaint priority based on keywords in title and description
 * Uses keyword matching and case-insensitive analysis
 */

/**
 * Define keyword patterns for each priority level
 */
const PRIORITY_KEYWORDS = {
    HIGH: {
        keywords: [
            'urgent', 'not working', 'failure', 'broken', 'critical', 'crash',
            'error', 'down', 'outage', 'emergency', 'asap', 'immediately',
            'stopped', 'failed', 'unable to', 'can\'t', 'cannot', 'blocked',
            'issue', 'severe', 'serious', 'problem'
        ],
        description: 'High priority detected from critical keywords'
    },
    MEDIUM: {
        keywords: [
            'delay', 'slow', 'delayed', 'sluggish', 'lag', 'hang', 'freeze',
            'stuck', 'timeout', 'unresponsive', 'performance', 'inefficient'
        ],
        description: 'Medium priority detected from performance keywords'
    }
};

/**
 * Detect priority from complaint text (title + description)
 * 
 * @param {String} title - Complaint title
 * @param {String} description - Complaint description
 * @param {String} userProvidedPriority - Optional priority provided by user (USER_PROVIDED = override, null/undefined = auto-detect)
 * @returns {Object} { priority: String, detectedFrom: String, confidence: Number, keywords: Array }
 * 
 * Priority levels: 'Critical', 'High', 'Medium', 'Low'
 * 
 * @example
 * const result = detectPriority('Website is down', 'The website crashed and is not working');
 * // Returns: { priority: 'High', detectedFrom: 'keywords', confidence: 0.95, keywords: ['down', 'not working'] }
 */
function detectPriority(title, description, userProvidedPriority = null) {
    // If user explicitly provided priority, respect it
    if (userProvidedPriority) {
        return {
            priority: userProvidedPriority,
            detectedFrom: 'user_provided',
            confidence: 1.0,
            keywords: [],
            note: 'Priority manually set by user'
        };
    }

    // Combine title and description for analysis
    const combinedText = `${title} ${description}`.toLowerCase();

    // Track detected keywords for each level
    const detectedKeywords = {
        HIGH: [],
        MEDIUM: []
    };

    // Check for HIGH priority keywords
    for (const keyword of PRIORITY_KEYWORDS.HIGH.keywords) {
        // Use word boundary matching to avoid false positives
        // e.g., "delay" shouldn't match in "delighted"
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = combinedText.match(regex);
        if (matches) {
            detectedKeywords.HIGH.push(...matches.map(m => m.toLowerCase()));
        }
    }

    // Check for MEDIUM priority keywords
    for (const keyword of PRIORITY_KEYWORDS.MEDIUM.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = combinedText.match(regex);
        if (matches) {
            detectedKeywords.MEDIUM.push(...matches.map(m => m.toLowerCase()));
        }
    }

    // Determine priority based on detected keywords
    let detectedPriority = 'Low';
    let confidence = 0;
    let matchedKeywords = [];

    if (detectedKeywords.HIGH.length > 0) {
        detectedPriority = 'High';
        confidence = Math.min(0.5 + (detectedKeywords.HIGH.length * 0.15), 1.0); // 0.5-1.0
        matchedKeywords = [...new Set(detectedKeywords.HIGH)]; // Remove duplicates
    } else if (detectedKeywords.MEDIUM.length > 0) {
        detectedPriority = 'Medium';
        confidence = Math.min(0.4 + (detectedKeywords.MEDIUM.length * 0.15), 0.95); // 0.4-0.95
        matchedKeywords = [...new Set(detectedKeywords.MEDIUM)];
    } else {
        detectedPriority = 'Low';
        confidence = 1.0; // Fully confident in default
    }

    return {
        priority: detectedPriority,
        detectedFrom: 'intelligent_detection',
        confidence: parseFloat(confidence.toFixed(2)),
        keywords: matchedKeywords,
        note: matchedKeywords.length > 0
            ? `Detected ${matchedKeywords.length} keyword(s): ${matchedKeywords.slice(0, 3).join(', ')}${matchedKeywords.length > 3 ? '...' : ''}`
            : 'No priority keywords detected, defaulting to Low'
    };
}

/**
 * Analyze complaint text and return detailed priority analysis
 * Useful for debugging and understanding why a priority was assigned
 * 
 * @param {String} title - Complaint title
 * @param {String} description - Complaint description
 * @returns {Object} Detailed analysis with all detected keywords and score breakdown
 */
function analyzePriorityDetailed(title, description) {
    const combinedText = `${title} ${description}`.toLowerCase();

    const analysis = {
        text: {
            title: title.substring(0, 100),
            description: description.substring(0, 200)
        },
        scores: {
            HIGH: { count: 0, keywords: [] },
            MEDIUM: { count: 0, keywords: [] },
            LOW: { count: 0, keywords: [] }
        },
        result: detectPriority(title, description),
        timestamp: new Date().toISOString()
    };

    // Score HIGH priority
    for (const keyword of PRIORITY_KEYWORDS.HIGH.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = combinedText.match(regex);
        if (matches) {
            analysis.scores.HIGH.count += matches.length;
            analysis.scores.HIGH.keywords.push(keyword);
        }
    }

    // Score MEDIUM priority
    for (const keyword of PRIORITY_KEYWORDS.MEDIUM.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = combinedText.match(regex);
        if (matches) {
            analysis.scores.MEDIUM.count += matches.length;
            analysis.scores.MEDIUM.keywords.push(keyword);
        }
    }

    analysis.scores.LOW.count = Math.max(0, 1 - analysis.scores.HIGH.count - analysis.scores.MEDIUM.count);

    return analysis;
}

/**
 * Get the keyword patterns (for reference/documentation)
 * Useful for frontend to show users what keywords trigger which priority
 * 
 * @returns {Object} Keyword patterns organized by priority
 */
function getKeywordPatterns() {
    return {
        HIGH: {
            keywords: PRIORITY_KEYWORDS.HIGH.keywords,
            description: 'Will trigger HIGH priority'
        },
        MEDIUM: {
            keywords: PRIORITY_KEYWORDS.MEDIUM.keywords,
            description: 'Will trigger MEDIUM priority'
        },
        LOW: {
            keywords: [],
            description: 'Default when no high/medium keywords detected'
        }
    };
}

module.exports = {
    detectPriority,
    analyzePriorityDetailed,
    getKeywordPatterns
};
