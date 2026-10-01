'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FlagIcon from '@mui/icons-material/OutlinedFlag';
import LinkIcon from '@mui/icons-material/OpenInNew';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { api, type Community, type ResourceItem } from '../../lib/api';
import { useApp } from '../../components/Providers';
import { AiSummary, CardGrid, EmptyState, LoadingCards, PageHeader, TagList } from '../../components/ui';
import { ReportDialog } from '../../components/ReportDialog';

const TYPES = ['ARTICLE', 'VIDEO', 'REPO', 'COURSE', 'TOOL', 'DOC'];

export default function ResourcesPage() {
  const { user, notify } = useApp();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ResourceItem | null>(null);
  const [form, setForm] = useState({ communityId: '', title: '', description: '', url: '', type: 'ARTICLE', tags: '' });

  // Live summarizer playground
  const [playground, setPlayground] = useState('');
  const [summary, setSummary] = useState<{ summary: string; highlights: string[]; provider: string } | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const load = async (search = '') => {
    setLoading(true);
    try {
      const result = await api.resources.list(search);
      setResources(result.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void api.communities.list().then((result) => {
      setCommunities(result.items);
      setForm((current) => ({ ...current, communityId: result.items[0]?.id ?? '' }));
    });
  }, []);

  const create = async () => {
    try {
      await api.resources.create({
        ...form,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      notify('Resource shared, summarised and indexed.', 'success');
      setOpen(false);
      await load(query);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not share the resource', 'error');
    }
  };

  const summarize = async () => {
    setSummarizing(true);
    try {
      setSummary(await api.ai.summarize(playground, 'bullets'));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Summarisation failed', 'error');
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Resources"
        subtitle="Curated knowledge shared by the community, automatically summarised and semantically indexed."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} disabled={!user}>
            {user ? 'Share resource' : 'Sign in to share'}
          </Button>
        }
      />

      <Stack direction="row" spacing={1.5} sx={{ mb: 3, maxWidth: 560 }}>
        <TextField
          fullWidth
          placeholder="Filter resources…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && load(query)}
        />
        <Button variant="outlined" onClick={() => load(query)}>
          Filter
        </Button>
      </Stack>

      {loading ? (
        <LoadingCards />
      ) : resources.length === 0 ? (
        <EmptyState title="No resources found" />
      ) : (
        <CardGrid>
          {resources.map((resource) => (
            <Card key={resource.id}>
              <CardContent>
                <Chip size="small" color="secondary" variant="outlined" label={resource.type} />
                <Typography variant="h5" sx={{ mt: 1 }}>
                  {resource.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {resource.communityName} · shared by {resource.authorName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  {resource.description.slice(0, 200)}…
                </Typography>
                <AiSummary text={resource.summary} />
                <TagList tags={resource.tags} />
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  {resource.url && (
                    <Button size="small" variant="contained" endIcon={<LinkIcon />} href={resource.url} target="_blank">
                      Open
                    </Button>
                  )}
                  <Button size="small" color="inherit" startIcon={<FlagIcon />} onClick={() => setReportTarget(resource)}>
                    Report
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </CardGrid>
      )}

      <PageHeader
        title="AI summarizer"
        subtitle="Paste a long announcement, meeting note or discussion thread and get a scannable summary with key topics."
      />
      <Card sx={{ '&:hover': { transform: 'none', boxShadow: 'none' } }}>
        <CardContent>
          <TextField
            fullWidth
            multiline
            minRows={6}
            placeholder="Paste a long text here…"
            value={playground}
            onChange={(event) => setPlayground(event.target.value)}
          />
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            sx={{ mt: 2 }}
            onClick={summarize}
            disabled={summarizing || playground.trim().length < 20}
          >
            {summarizing ? 'Summarising…' : 'Summarise'}
          </Button>

          {summary && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="overline" color="text.secondary">
                Summary · provider: {summary.provider}
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line', mt: 1 }}>
                {summary.summary}
              </Typography>
              <TagList tags={summary.highlights} max={8} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share a resource</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Community"
              value={form.communityId}
              onChange={(event) => setForm({ ...form, communityId: event.target.value })}
            >
              {communities.map((community) => (
                <MenuItem key={community.id} value={community.id}>
                  {community.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            <TextField
              label="Description"
              multiline
              minRows={4}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
            <TextField label="URL" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} />
            <TextField select label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Tags (comma separated)"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create}>
            Share
          </Button>
        </DialogActions>
      </Dialog>

      <ReportDialog
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetType="RESOURCE"
        targetId={reportTarget?.id ?? ''}
        targetTitle={reportTarget?.title ?? ''}
      />
    </Box>
  );
}
