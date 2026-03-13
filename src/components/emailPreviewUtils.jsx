export const rawSanitize = (text) => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lcub;/g, '{')
    .replace(/&rcub;/g, '}')
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}')
    .replace(/&lbrace;/g, '{')
    .replace(/&rbrace;/g, '}')
    .replace(/[ \t]+/g, ' ')
    .trim();
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