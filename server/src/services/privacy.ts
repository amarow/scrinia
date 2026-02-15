import { privacyRepository } from '../db/repository';

const PRESETS: Record<string, string> = {
    'EMAIL': '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    'IBAN': '[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}',
    'IPV4': '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
    'PHONE': '(?:\\+?49|0)(?:\\s*\\d{2,5}\\s*)(?:\\d{3,9})'
};

function escapeHtml(unsafe: string) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

const REDACTED_STYLE = 'color: #228be6; font-weight: bold; background: rgba(34, 139, 230, 0.1); padding: 0 2px; border-radius: 2px; border: 1px solid rgba(34, 139, 230, 0.2);';

export const privacyService = {
  async redactText(text: string, profileId: number, asHtml: boolean = false): Promise<string> {
    const rules = await privacyRepository.getRules(profileId);
    let redactedText = asHtml ? escapeHtml(text) : text;

    for (const rule of rules as any[]) {
      if (!rule.isActive) continue;

      try {
        let regex: RegExp;
        
        // If it's a regex-based type and has a pattern, use the pattern
        const isRegexBased = rule.type === 'REGEX' || !!PRESETS[rule.type];
        
        if (isRegexBased && rule.pattern) {
          regex = new RegExp(rule.pattern, 'gi');
        } else if (PRESETS[rule.type]) {
          regex = new RegExp(PRESETS[rule.type], 'gi');
        } else if (rule.type === 'LITERAL') {
          const escapedPattern = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          regex = new RegExp(escapedPattern, 'gi');
        } else {
          // Fallback
          const escapedPattern = (rule.pattern || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          regex = new RegExp(escapedPattern, 'gi');
        }

        const replacement = asHtml 
            ? `<span style="${REDACTED_STYLE}">${escapeHtml(rule.replacement)}</span>`
            : rule.replacement;

        redactedText = redactedText.replace(regex, replacement);
      } catch (e) {
        console.error(`[Privacy] Error applying rule ${rule.id}:`, e);
      }
    }

    return redactedText;
  },

  async redactWithMultipleProfiles(text: string, profileIds: number[], asHtml: boolean = false): Promise<string> {
    if (!profileIds || profileIds.length === 0) return asHtml ? escapeHtml(text) : text;

    let result = asHtml ? escapeHtml(text) : text;
    
    for (const profileId of profileIds) {
      const rules = await privacyRepository.getRules(profileId);
      for (const rule of rules as any[]) {
        if (!rule.isActive) continue;

        try {
          let regex: RegExp;
          const isRegexBased = rule.type === 'REGEX' || !!PRESETS[rule.type];

          if (isRegexBased && rule.pattern) {
            regex = new RegExp(rule.pattern, 'gi');
          } else if (PRESETS[rule.type]) {
            regex = new RegExp(PRESETS[rule.type], 'gi');
          } else {
            const escapedPattern = (rule.pattern || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(escapedPattern, 'gi');
          }

          const replacement = asHtml 
            ? `<span style="${REDACTED_STYLE}">${escapeHtml(rule.replacement)}</span>`
            : rule.replacement;

          result = result.replace(regex, replacement);
        } catch (e) {
          console.error(`[Privacy] Error applying rule ${rule.id}:`, e);
        }
      }
    }
    return result;
  }
};
