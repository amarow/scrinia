"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.privacyService = void 0;
const repository_1 = require("../db/repository");
const PRESETS = {
    'EMAIL': '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    'IBAN': '[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}',
    'IPV4': '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
    'PHONE': '(?:(?:phone|tel|mobile|mobil|telefon)\\s*[:\\-]?\\s*)(?:\\+?49|0)(?:\\s*\\d{2,5}\\s*)(?:\\d{3,9})'
};
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
const COLORS = [
    '#228be6', // Blue
    '#fa5252', // Red
    '#be4bdb', // Grape
    '#12b886', // Teal
    '#fab005', // Yellow
    '#fd7e14', // Orange
    '#7950f2', // Violet
    '#40c057', // Green
    '#15aabf', // Cyan
    '#e64980', // Pink
    '#82c91e', // Lime
    '#4c6ef5' // Indigo
];
function getRuleColor(ruleId) {
    const index = Math.abs(ruleId) % COLORS.length;
    return COLORS[index];
}
function getRedactedStyle(color) {
    return `color: ${color}; font-weight: bold; background: ${color}1A; padding: 0 2px; border-radius: 2px; border: 1px solid ${color}33; cursor: pointer;`;
}
exports.privacyService = {
    async redactText(text, profileId, asHtml = false) {
        const rules = await repository_1.privacyRepository.getRules(profileId);
        let redactedText = asHtml ? escapeHtml(text) : text;
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
                const color = getRuleColor(rule.id);
                const replacement = asHtml
                    ? `<span style='${getRedactedStyle(color)}' data-rule-id='${rule.id}' data-profile-id='${profileId}' class='redacted-text'>${escapeHtml(rule.replacement)}</span>`
                    : rule.replacement;
                redactedText = redactedText.replace(regex, replacement);
            }
            catch (e) {
                console.error(`[Privacy] Error applying rule ${rule.id}:`, e);
            }
        }
        return redactedText;
    },
    async redactWithMultipleProfiles(text, profileIds, asHtml = false) {
        if (!profileIds || profileIds.length === 0)
            return asHtml ? escapeHtml(text) : text;
        let result = asHtml ? escapeHtml(text) : text;
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
                    const color = getRuleColor(rule.id);
                    const replacement = asHtml
                        ? `<span style='${getRedactedStyle(color)}' data-rule-id='${rule.id}' data-profile-id='${profileId}' class='redacted-text'>${escapeHtml(rule.replacement)}</span>`
                        : rule.replacement;
                    result = result.replace(regex, replacement);
                }
                catch (e) {
                    console.error(`[Privacy] Error applying rule ${rule.id}:`, e);
                }
            }
        }
        return result;
    }
};
