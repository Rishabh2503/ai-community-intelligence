'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/GppMaybe';
import { api, type ReportItem, type TriageResult } from '../../lib/api';
import { useApp } from '../../components/Providers';
import { EmptyState, LoadingCards, PageHeader } from '../../components/ui';
import { RequireRole } from '../../components/RequireRole';
import { ROUTE_ROLES } from '../../lib/access';

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  PENDING: 'warning',
  REVIEWING: 'info',
  RESOLVED: 'success',
  DISMISSED: 'default',
};

const VERDICT_COLORS: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
  LIKELY_DUPLICATE: 'warning',
  LIKELY_SPAM: 'error',
  POSSIBLY_INAPPROPRIATE: 'error',
  NEEDS_HUMAN_REVIEW: 'warning',
  LIKELY_FINE: 'success',
};

/** Admin-only route: the report queue is not visible to members or organizers. */
export default function ModerationRoute() {
  return (
    <RequireRole roles={ROUTE_ROLES['/moderation']}>
      <ModerationQueue />
    </RequireRole>
  );
}

/** Moderation queue sorted by AI priority score, plus a triage sandbox. */
function ModerationQueue() {
  const { notify } = useApp();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);

  const [sandbox, setSandbox] = useState({ entityType: 'RESOURCE', title: '', body: '' });
  const [triage, setTriage] = useState<TriageResult | null>(null);

  const load = async (value = status) => {
    setLoading(true);
    try {
      const result = await api.moderation.reports(value || undefined);
      setReports(result.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const resolve = async (report: ReportItem, nextStatus: string) => {
    try {
      await api.moderation.resolve(report.id, nextStatus, `Marked ${nextStatus.toLowerCase()} by moderator`);
      notify(`Report ${nextStatus.toLowerCase()}.`, 'success');
      await load(status);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Admin role required', 'error');
    }
  };

  const runTriage = async () => {
    try {
      setTriage(await api.moderation.triage(sandbox));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Triage failed', 'error');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Moderation"
        subtitle="Reports are automatically triaged: near-duplicate detection via embeddings, spam pattern matching and a flagged-term lexicon. A human always makes the final call."
      />

      <ToggleButtonGroup
        exclusive
        value={status}
        onChange={(_, value) => setStatus(value ?? '')}
        size="small"
        sx={{ mb: 3 }}
      >
        {['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED', ''].map((item) => (
          <ToggleButton key={item || 'ALL'} value={item} sx={{ borderRadius: 999, px: 2 }}>
            {item || 'All'}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {loading ? (
        <LoadingCards count={3} />
      ) : reports.length === 0 ? (
        <EmptyState title="Queue is clear" hint="No reports with this status." />
      ) : (
        <Stack spacing={2}>
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={report.targetType} variant="outlined" />
                      <Chip size="small" label={report.reason} color="error" variant="outlined" />
                      <Chip size="small" label={report.status} color={STATUS_COLORS[report.status] ?? 'default'} />
                    </Stack>
                    <Typography variant="h6">{report.targetTitle || report.targetId}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {report.details || 'No additional details provided.'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Reported by {report.reporterName} · {new Date(report.createdAt).toLocaleString()}
                    </Typography>

                    <Box
                      sx={{
                        mt: 1.5,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        display: 'flex',
                        gap: 1.5,
                        alignItems: 'flex-start',
                      }}
                    >
                      <ShieldIcon color="warning" />
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            size="small"
                            label={report.aiVerdict.replace(/_/g, ' ')}
                            color={VERDICT_COLORS[report.aiVerdict] ?? 'default'}
                          />
                          <Typography variant="caption" fontWeight={800}>
                            priority {Math.round(report.aiScore * 100)}%
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {report.aiRationale}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Stack spacing={1} sx={{ minWidth: 170 }}>
                    <Button size="small" variant="contained" color="success" onClick={() => resolve(report, 'RESOLVED')}>
                      Resolve
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => resolve(report, 'REVIEWING')}>
                      Mark reviewing
                    </Button>
                    <Button size="small" color="inherit" onClick={() => resolve(report, 'DISMISSED')}>
                      Dismiss
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <PageHeader
        title="Triage sandbox"
        subtitle="Paste content to see what the automated checks would say before it is published."
      />
      <Card sx={{ '&:hover': { transform: 'none', boxShadow: 'none' } }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              select
              label="Content type"
              value={sandbox.entityType}
              onChange={(event) => setSandbox({ ...sandbox, entityType: event.target.value })}
              sx={{ maxWidth: 260 }}
            >
              {['EVENT', 'RESOURCE', 'ANNOUNCEMENT', 'POST', 'PROJECT'].map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Title"
              value={sandbox.title}
              onChange={(event) => setSandbox({ ...sandbox, title: event.target.value })}
            />
            <TextField
              label="Body"
              multiline
              minRows={4}
              value={sandbox.body}
              onChange={(event) => setSandbox({ ...sandbox, body: event.target.value })}
            />
            <Button variant="contained" onClick={runTriage} disabled={!sandbox.title}>
              Run triage
            </Button>

            {triage && (
              <>
                <Divider />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={triage.verdict.replace(/_/g, ' ')} color={VERDICT_COLORS[triage.verdict] ?? 'default'} />
                  <Typography variant="body2" fontWeight={700}>
                    priority {Math.round(triage.score * 100)}%
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {triage.rationale}
                </Typography>
                {triage.duplicates.length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight={800}>
                      POSSIBLE DUPLICATES
                    </Typography>
                    {triage.duplicates.map((duplicate) => (
                      <Typography key={duplicate.entityId} variant="body2" color="text.secondary">
                        • {duplicate.title} — {Math.round(duplicate.similarity * 100)}% similar
                      </Typography>
                    ))}
                  </Box>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
