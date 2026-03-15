// Full HTML-to-plain-text conversion (mirrors backend htmlToPlainText logic)
export const htmlToPlainText = (html) => {
  if (!html) return '';
  let s = String(html);
  // Decode brace entities first so {{variables}} survive
  s = s.replace(/&lcub;/g, '{').replace(/&rcub;/g, '}')
       .replace(/&#123;/g, '{').replace(/&#125;/g, '}')
       .replace(/&lbrace;/g, '{').replace(/&rbrace;/g, '}');
  // Block tags → newlines
  s = s.replace(/<br\s*\/?>/gi, '\n')
       .replace(/<\/p\s*>/gi, '\n')
       .replace(/<\/div\s*>/gi, '\n')
       .replace(/<\/li\s*>/gi, '\n');
  // Strip ALL remaining tags
  s = s.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  s = s.replace(/&nbsp;/g, ' ')
       .replace(/&#160;/g, ' ')
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
       .replace(/&apos;/g, "'");
  // Clean up whitespace
  s = s.replace(/[ \t]+/g, ' ')
       .replace(/\n /g, '\n')
       .replace(/ \n/g, '\n')
       .replace(/\n{3,}/g, '\n\n')
       .trim();
  return s;
};

// Lightweight sanitizer (strips tags + entities, no newline handling)
export const rawSanitize = (text) => {
  if (!text) return '';
  return htmlToPlainText(text);
};

export const fuzzyReplaceVariables = (text, variableMap) => {
  if (!text) return '';
  let result = rawSanitize(text);
  result = result.replace(/\{\{([^}]+)\}\}/gi, (match, varName) => {
    const key = varName.toLowerCase().replace(/\s+/g, '').trim();
    return variableMap[key] !== undefined ? variableMap[key] : match;
  });
  return result;
};

export const formatBodyToHtml = (processedBody) => {
  if (!processedBody) return '';
  return '<p>' + processedBody
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    + '</p>';
};

export const DEFAULT_VARIABLE_MAP = {
  firstname: 'John',
  lastname: 'Doe',
  email: 'john@example.com',
  companyname: 'Acme Corp',
  companywebsite: 'acme.com',
  industry: 'Technology',
  state: 'NY',
  market: 'Enterprise',
  senderfirstname: '',
  senderlastname: '',
  sendersignature: '',
};