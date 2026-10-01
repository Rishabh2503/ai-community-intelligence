'use client';

import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import TableChartIcon from '@mui/icons-material/TableChart';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { api, type ImportSummary, type WebIngestResult } from '../lib/api';
import { useApp } from './Providers';

/**
 * Live ingestion panel: pull a public web page, or bulk-import a spreadsheet.
 * Both paths reuse the normal publish pipeline, so new content is summarised
 * and searchable immediately - which is exactly what makes it demoable.
 */
export function LiveDataPanel({ onIngested }: { onIngested?: (label: string) => void }) {
  const { user, notify } = useApp();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'url' | 'excel' | null>(null);
  const [scraped, setScraped] = useState<WebIngestResult | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canPublish = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';

  const ingestUrl = async () => {
    if (!url.trim() || busy) return;
    setBusy('url');
    setScraped(null);
    try {
      const result = await api.imports.url(url.trim());
      setScraped(result);
      setUrl('');
      notify(`Indexed "${result.title}" — ${result.wordCount} words, ready to query.`, 'success');
      onIngested?.(result.title);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not ingest that page', 'error');
    } finally {
      setBusy(null);
    }
  };

  const importExcel = async (file: File) => {
    setBusy('excel');
    setSummary(null);
    try {
      const result = await api.imports.excel(file);
      setSummary(result);
      notify(`Imported ${result.imported} rows — all summarised and indexed.`, 'success');
      onIngested?.(`${result.imported} imported rows`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Import failed', 'error');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!canPublish) return null;

  return (
    <Box sx={{ mb: 3, p: 2, borderRadius: 3, border: (theme) => `1px dashed ${theme.palette.divider}` }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={800}>
          Add live knowledge
        </Typography>
        <Chip size="small" label="indexed instantly" color="secondary" variant="outlined" />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="https://example.com/article-to-learn-from"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && ingestUrl()}
          disabled={busy !== null}
        />
        <Button
          variant="contained"
          startIcon={busy === 'url' ? <CircularProgress size={16} color="inherit" /> : <LanguageIcon />}
          onClick={ingestUrl}
          disabled={busy !== null || !url.trim()}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Scrape &amp; index
        </Button>

        <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />

        <Button
          variant="outlined"
          startIcon={busy === 'excel' ? <CircularProgress size={16} /> : <UploadFileIcon />}
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Import Excel
        </Button>
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          href={api.imports.templateUrl()}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Template
        </Button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".xlsx,.xls,.csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importExcel(file);
          }}
        />
      </Stack>

      <Collapse in={Boolean(scraped)}>
        {scraped && (
          <Alert severity="success" icon={<LanguageIcon />} sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={700}>
              {scraped.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {scraped.wordCount} words scraped and indexed in {scraped.tookMs} ms — ask a question about it now.
            </Typography>
            {scraped.summary && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>AI summary:</strong> {scraped.summary}
              </Typography>
            )}
          </Alert>
        )}
      </Collapse>

      <Collapse in={Boolean(summary)}>
        {summary && (
          <Alert severity={summary.skipped > 0 ? 'warning' : 'success'} icon={<TableChartIcon />} sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={700}>
              {summary.imported} imported · {summary.skipped} skipped
            </Typography>
            <Stack spacing={0.25} sx={{ mt: 0.5 }}>
              {summary.results.slice(0, 8).map((result) => (
                <Typography key={`${result.sheet}-${result.row}`} variant="caption" color="text.secondary">
                  {result.status === 'IMPORTED' ? '✓' : '✕'} {result.sheet} row {result.row}:{' '}
                  {result.title || '(no title)'}
                  {result.reason ? ` — ${result.reason}` : ''}
                </Typography>
              ))}
            </Stack>
          </Alert>
        )}
      </Collapse>
    </Box>
  );
}
