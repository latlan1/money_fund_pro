/**
 * CSV Loader Module
 * Handles parsing of CSV data into JavaScript objects
 */

/**
 * Main parser function attached to window
 * Maps CSV rows to objects using the first row as headers
 * @param {string} text - The raw CSV text
 * @returns {Array<Object>} Array of objects mapping headers to values
 */
window.parseCSV = function(text) {
    if (!text || text.trim() === '') return [];

    const lines = text.split(/\r?\n/);
    if (lines.length < 1) return [];

    // Extract headers from first line
    const headers = parseCSVLine(lines[0]);
    
    // Process remaining lines
    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;

        const values = parseCSVLine(line);
        const row = {};
        
        headers.forEach((header, index) => {
            // Use the header name as the key, handle potential missing values
            const key = header.trim();
            row[key] = values[index] !== undefined ? values[index] : '';
        });
        
        results.push(row);
    }
    
    return results;
};

/**
 * Helper to parse a single CSV line, handling quoted fields and escaped quotes
 * @param {string} line - A single row from the CSV
 * @returns {Array<string>} Array of values
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Handle escaped quotes (double quotes "")
                current += '"';
                i++; // Skip the second quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field (only if not inside quotes)
            result.push(cleanValue(current));
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add the final field
    result.push(cleanValue(current));
    
    return result;
}

/**
 * Helper to clean whitespace and surrounding quotes from a parsed value
 */
function cleanValue(val) {
    let value = val.trim();
    if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
    }
    return value;
}