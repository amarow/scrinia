"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.privacyService = void 0;
const repository_1 = require("../db/repository");
const PRESETS = {
    'EMAIL': '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    'IBAN': '[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}',
    'IPV4': '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
    'PHONE': '(?:\\+?49|0)(?:\\s*\\d{2,5}\\s*)(?:\\d{3,9})'
};
exports.privacyService = {
    async redactText(text, profileId) {
        const rules = await repository_1.privacyRepository.getRules(profileId);
        let redactedText = text;
        for (const rule of rules) {
            if (!rule.isActive)
                continue;
            try {
                let regex;
                // If it's a regex-based type and has a pattern, use the pattern
                const isRegexBased = rule.type === 'REGEX' || !!PRESETS[rule.type];
                if (isRegexBased && rule.pattern) {
                    regex = new RegExp(rule.pattern, 'gi');
                }
                else if (PRESETS[rule.type]) {
                    regex = new RegExp(PRESETS[rule.type], 'gi');
                }
                else if (rule.type === 'LITERAL') {
                    const escapedPattern = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    regex = new RegExp(escapedPattern, 'gi');
                }
                else {
                    // Fallback
                    const escapedPattern = (rule.pattern || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    regex = new RegExp(escapedPattern, 'gi');
                }
                redactedText = redactedText.replace(regex, rule.replacement);
            }
            catch (e) {
                console.error(`[Privacy] Error applying rule ${rule.id}:`, e);
            }
        }
        return redactedText;
    },
    async redactWithMultipleProfiles(text, profileIds) {
        if (!profileIds || profileIds.length === 0)
            return text;
        // Fetch all rules for all profiles in one go if possible, or sequentially fetch rules only
        // To keep it simple and maintain the order of profiles, we fetch rules for each profile.
        // However, we apply all gathered rules sequentially on the same text.
        let result = text;
        // gathering all rules first would be an option, but applying them directly is also fine 
        // as long as we don't re-parse the whole document unnecessarily.
        // Actually, String.replace in JS is already quite efficient.
        for (const profileId of profileIds) {
            const rules = await repository_1.privacyRepository.getRules(profileId);
            for (const rule of rules) {
                if (!rule.isActive)
                    continue;
                try {
                    let regex;
                    const isRegexBased = rule.type === 'REGEX' || !!PRESETS[rule.type];
                    if (isRegexBased && rule.pattern) {
                        regex = new RegExp(rule.pattern, 'gi');
                    }
                    else if (PRESETS[rule.type]) {
                        regex = new RegExp(PRESETS[rule.type], 'gi');
                    }
                    else {
                        const escapedPattern = (rule.pattern || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        regex = new RegExp(escapedPattern, 'gi');
                    }
                    result = result.replace(regex, rule.replacement);
                }
                catch (e) {
                    console.error(`[Privacy] Error applying rule ${rule.id}:`, e);
                }
            }
        }
        return result;
    }
};
