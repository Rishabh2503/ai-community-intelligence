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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GroupsIcon from '@mui/icons-material/Groups';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { api, type AnnouncementItem, type Community } from '../../lib/api';
import { usePreferredLocation } from '../../lib/location';
import { useApp } from '../../components/Providers';
import { AiSummary, CardGrid, EmptyState, LoadingCards, PageHeader, TagList } from '../../components/ui';

export default function CommunitiesPage() {
  const { user, notify } = useApp();
  const { location, setLocation } = usePreferredLocation();
  const [region, setRegion] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: '', tags: '', location: 'Online' });

  const load = async (search = query, region = location) => {
    setLoading(true);
    try {
      const [communityResult, announcementResult] = await Promise.all([
        api.communities.list({ q: search, location: region }),
        api.announcements.list(),
      ]);
      setCommunities(communityResult.items);
      setAnnouncements(announcementResult.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRegion(location);
    void load('', location);
  }, [location]);

  const create = async () => {
    try {
      await api.communities.create({
        ...form,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      notify('Community created and indexed.', 'success');
      setOpen(false);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create the community', 'error');
    }
  };

  const join = async (community: Community) => {
    try {
      await api.communities.join(community.id);
      notify(`Joined ${community.name}. Recommendations will adapt.`, 'success');
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Sign in to join', 'error');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Communities"
        subtitle="Structured spaces with their own events, resources, announcements and discussions."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} disabled={!user}>
            {user ? 'Create community' : 'Sign in to create'}
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && load()}
          placeholder="Search communities"
          sx={{ flex: 1 }}
        />
        <TextField
          label="Region"
          placeholder="e.g. Bengaluru, India"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          InputProps={{ startAdornment: <LocationOnIcon color="action" sx={{ mr: 1 }} /> }}
          sx={{ minWidth: { sm: 240 } }}
        />
        <Button variant="outlined" onClick={() => {
          if (region.trim() === location) void load(query, region);
          else setLocation(region);
        }}>Apply</Button>
      </Stack>

      {loading ? (
        <LoadingCards />
      ) : communities.length === 0 ? (
        <EmptyState title="No nearby communities found" hint="Clear the region to explore every community." />
      ) : (
        <CardGrid>
          {communities.map((community) => (
            <Card key={community.id}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <GroupsIcon color="success" />
                  <Chip size="small" color="success" variant="outlined" label={community.category} />
                </Stack>
                <Typography variant="h5">{community.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {community.location} · {community.memberCount} members · {community.eventCount} events
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  {community.description}
                </Typography>
                <TagList tags={community.tags} />
                <Button size="small" variant="contained" sx={{ mt: 2 }} onClick={() => join(community)}>
                  Join community
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardGrid>
      )}

      <PageHeader
        title="Latest announcements"
        subtitle="Long announcements are condensed by AI so members can scan them quickly."
      />
      <CardGrid columns={2}>
        {announcements.map((announcement) => (
          <Card key={announcement.id}>
            <CardContent>
              <Chip
                size="small"
                color={announcement.priority === 'HIGH' ? 'warning' : 'default'}
                label={announcement.priority}
              />
              <Typography variant="h5" sx={{ mt: 1 }}>
                {announcement.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {announcement.communityName} · {announcement.authorName} ·{' '}
                {new Date(announcement.createdAt).toLocaleDateString()}
              </Typography>
              <AiSummary text={announcement.summary} title="AI summary of this announcement" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {announcement.body.slice(0, 320)}…
              </Typography>
            </CardContent>
          </Card>
        ))}
      </CardGrid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create a community</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <TextField
              label="Description"
              multiline
              minRows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
            <TextField
              label="Category"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            />
            <TextField
              label="Location"
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
            />
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
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
