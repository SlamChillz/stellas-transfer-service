import { Request, Response } from 'express';
import { ERROR_CODES, ERROR_DESCRIPTIONS } from '../types/errors';

function getDocsHtml(): string {
  const codes = Object.values(ERROR_CODES);
  const sections = codes
    .map(
      (code) =>
        `<section id="${code}"><h2>${code}</h2><p>${ERROR_DESCRIPTIONS[code] ?? 'No description.'}</p></section>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stellas Transfer API – Error reference</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    section { margin: 1.5rem 0; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
    section:last-child { border-bottom: none; }
    h2 { font-size: 1rem; margin: 0 0 0.25rem 0; color: #333; }
    p { margin: 0; color: #666; font-size: 0.9rem; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>Error reference</h1>
  <p>API error responses include a <code>type</code> field. In development, <code>type</code> is a fragment link to this page (e.g. <code>/docs#VALIDATION_ERROR</code>).</p>
  ${sections}
</body>
</html>`;
}

let cachedHtml: string | null = null;

export function docsRoute(_req: Request, res: Response): void {
  if (!cachedHtml) cachedHtml = getDocsHtml();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(cachedHtml);
}
