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
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FlagIcon from '@mui/icons-material/OutlinedFlag';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { api, type Community, type EventItem, type TriageResult } from '../../lib/api';
import { usePreferredLocation } from '../../lib/location';
import { useApp } from '../../components/Providers';
import { AiSummary, CardGrid, EmptyState, LoadingCards, PageHeader, TagList } from '../../components/ui';
import { BannerGenerator } from '../../components/BannerGenerator';
import { ReportDialog } from '../../components/ReportDialog';

const MODES = ['ONLINE', 'OFFLINE', 'HYBRID'];

const isoLocal = (daysAhead: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
};

/** Structured event publishing + AI summaries + reporting. */
export default function EventsPage() {
  const { user, notify } = useApp();
  const { location, setLocation } = usePreferredLocation();
  const [region, setRegion] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('');
  const [open, setOpen] = useState(false);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [reportTarget, setReportTarget] = useState<EventItem | null>(null);
  const [form, setForm] = useState({
    communityId: '',
    title: '',
    description: '',
    mode: 'ONLINE',
    venue: 'Online',
    startsAt: isoLocal(7),
    endsAt: isoLocal(7),
    capacity: 100,
    tags: '',
    bannerUrl: '',
  });

  const load = async (search = query, region = location, eventMode = mode) => {
    setLoading(true);
    try {
      const result = await api.events.list({
        ...(search ? { q: search } : {}),
        ...(region ? { location: region } : {}),
        ...(eventMode ? { mode: eventMode } : {}),
        upcoming: 'true',
      });
      setEvents(result.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRegion(location);
    void load('', location, '');
    void api.communities.list().then((result) => {
      setCommunities(result.items);
      setForm((current) => ({ ...current, communityId: result.items[0]?.id ?? '' }));
    });
  }, [location]);

  const checkQuality = async () => {
    try {
      setTriage(await api.moderation.triage({ entityType: 'EVENT', title: form.title, body: form.description }));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Quality check failed', 'error');
    }
  };

  const publish = async () => {
    try {
      await api.events.create({
        ...form,
        capacity: Number(form.capacity),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      notify('Event published, summarised and indexed for search.', 'success');
      setOpen(false);
      setTriage(null);
      await load(query);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not publish the event', 'error');
    }
  };

  const rsvp = async (event: EventItem) => {
    try {
      const result = await api.events.rsvp(event.id);
      notify(`You are going to "${event.title}" (${result.rsvpCount} attending).`, 'success');
      await load(query);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Sign in to RSVP', 'error');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Events"
        subtitle="Organizers publish structured events; long descriptions are condensed automatically and indexed for semantic search."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} disabled={!user}>
            {user ? 'Publish event' : 'Sign in to publish'}
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <TextField
          sx={{ flex: 1 }}
          placeholder="Search events"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && load(query)}
        />
        <TextField
          label="Region"
          placeholder="e.g. Pune, India"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          InputProps={{ startAdornment: <LocationOnIcon color="action" sx={{ mr: 1 }} /> }}
          sx={{ minWidth: { md: 220 } }}
        />
        <TextField select label="Mode" value={mode} onChange={(event) => setMode(event.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All modes</MenuItem>
          {MODES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
        </TextField>
        <Button variant="outlined" onClick={() => {
          if (region.trim() === location) void load(query, region, mode);
          else setLocation(region);
        }}>Apply</Button>
      </Stack>

      {loading ? (
        <LoadingCards />
      ) : events.length === 0 ? (
        <EmptyState title="No nearby events found" hint="Clear the region to explore events everywhere." />
      ) : (
        <CardGrid>
          {events.map((event) => (
            <Card key={event.id}>
              {event.bannerUrl && (
                <Box sx={{ position: 'relative', aspectRatio: '1200 / 630', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event.bannerUrl}
                    alt={`${event.title} banner`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'flex-end',
                      p: 2,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0) 60%)',
                    }}
                  >
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, lineHeight: 1.2 }}>
                      {event.title}
                    </Typography>
                  </Box>
                </Box>
              )}
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip size="small" color="primary" label={event.mode} />
                  <Chip size="small" variant="outlined" label={`${event.rsvpCount} going`} />
                </Stack>
                <Typography variant="h5">{event.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(event.startsAt).toLocaleString()} · {event.venue} · {event.communityName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  {event.description.slice(0, 200)}…
                </Typography>
                <AiSummary text={event.summary} />
                <TagList tags={event.tags} />
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" variant="contained" onClick={() => rsvp(event)}>
                    RSVP
                  </Button>
                  <Button size="small" startIcon={<FlagIcon />} color="inherit" onClick={() => setReportTarget(event)}>
                    Report
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </CardGrid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Publish an event</DialogTitle>
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
              minRows={5}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              helperText="Write it in full — the AI generates the short summary shown on cards."
            />
            <Stack direction="row" spacing={2}>
              <TextField select label="Mode" value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })} fullWidth>
                {MODES.map((mode) => (
                  <MenuItem key={mode} value={mode}>
                    {mode}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Venue" value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} fullWidth />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                type="datetime-local"
                label="Starts"
                InputLabelProps={{ shrink: true }}
                value={form.startsAt}
                onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                fullWidth
              />
              <TextField
                type="datetime-local"
                label="Ends"
                InputLabelProps={{ shrink: true }}
                value={form.endsAt}
                onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
                fullWidth
              />
            </Stack>
            <TextField
              label="Tags (comma separated)"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
            />

            <BannerGenerator
              description={`${form.title}. ${form.description}`}
              value={form.bannerUrl}
              title={form.title}
              onChange={(bannerUrl) => setForm({ ...form, bannerUrl })}
            />

            {triage && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" fontWeight={800}>
                  AI pre-publish check: {triage.verdict.replace(/_/g, ' ')} ({Math.round(triage.score * 100)}%)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {triage.rationale}
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={checkQuality}>Run AI duplicate check</Button>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={publish}>
            Publish
          </Button>
        </DialogActions>
      </Dialog>

      <ReportDialog
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetType="EVENT"
        targetId={reportTarget?.id ?? ''}
        targetTitle={reportTarget?.title ?? ''}
      />
    </Box>
  );
}
