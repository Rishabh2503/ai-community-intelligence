'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Autocomplete, Avatar, Box, Button, Card, Chip, Divider, IconButton, InputAdornment, Skeleton, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PublicIcon from '@mui/icons-material/Public';
import { api, type LiveDiscovery } from '../lib/api';
import { communityDirectory, directoryMatches, directoryReviewedAt } from '../lib/community-directory';
import { usePreferredLocation } from '../lib/location';

type Event = LiveDiscovery['items'][number];
const SAVED_KEY = 'community-space-saved-events';
const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function CommunityCard({ community }: { community: typeof communityDirectory[number] }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'none' }}>
      <Box sx={{ aspectRatio: '3 / 1', bgcolor: 'action.hover', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
        {community.image && !imageFailed ? <Box component="img" src={community.image} alt={`${community.name} community banner`} loading="lazy" onError={() => setImageFailed(true)} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Avatar sx={{ bgcolor: community.color, width: 56, height: 56, fontWeight: 800 }}>{community.initials}</Avatar>}
      </Box>
      <Stack spacing={1.5} sx={{ p: 2.5, flex: 1 }}>
        <Typography variant="overline" color="text.secondary">{community.category}</Typography>
        <Typography variant="h5">{community.name}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center"><LocationOnOutlinedIcon sx={{ fontSize: 16 }} /><Typography variant="caption">{community.location}</Typography></Stack>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{community.description}</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap">{community.topics.map((topic) => <Chip key={topic} size="small" label={topic} variant="outlined" />)}</Stack>
        <Button component="a" href={community.url} target="_blank" rel="noopener noreferrer" endIcon={<ArrowOutwardIcon />} sx={{ alignSelf: 'flex-start', px: 0 }}>Visit on Commudle</Button>
      </Stack>
    </Card>
  );
}

export function DiscoveryHub({ initialTab = 'events' }: { initialTab?: 'events' | 'communities' }) {
  const { location, setLocation } = usePreferredLocation();
  const [region, setRegion] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [tab, setTab] = useState<'events' | 'communities' | 'saved'>(initialTab);
  const [data, setData] = useState<LiveDiscovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [saved, setSaved] = useState<Event[]>([]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
      if (Array.isArray(stored)) setSaved(stored.filter((item): item is Event => Boolean(item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.location === 'string' && typeof item.startsAt === 'string' && Number.isFinite(Date.parse(item.startsAt)) && typeof item.url === 'string' && /^https?:\/\//.test(item.url))));
    } catch { setSaved([]); }
  }, []);
  useEffect(() => { setRegion(location); }, [location]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    void api.liveDiscovery(location, appliedQuery).then((result) => { if (current) setData(result); })
      .catch(() => { if (current) { setData(null); setError('The event directory could not be reached. Please try again.'); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [location, appliedQuery, refresh]);

  const toggleSaved = (event: Event) => {
    const next = saved.some((item) => item.id === event.id) ? saved.filter((item) => item.id !== event.id) : [...saved, event];
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); setSaved(next); }
    catch { setError('Your browser could not save this event. Check available browser storage.'); }
  };
  const communities = communityDirectory.filter((community) => directoryMatches(community.location, location) && `${community.name} ${community.topics.join(' ')} ${community.description}`.toLowerCase().includes(appliedQuery.toLowerCase()));
  const events = tab === 'saved' ? saved.filter((event) => directoryMatches(event.location, location) && event.name.toLowerCase().includes(appliedQuery.toLowerCase())) : data?.items ?? [];
  const clearFilters = () => { setRegion(''); setLocation(''); setQuery(''); setAppliedQuery(''); };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
        <Box><Typography variant="overline" color="primary.main" fontWeight={800}>THE DEVELOPER DIRECTORY</Typography><Typography variant="h1" sx={{ fontSize: { xs: '1.8rem', md: '2.25rem' }, mt: 0.5 }}>Communities. Events. Connections.</Typography></Box>
        <Button component={Link} href="/settings" variant="outlined" sx={{ alignSelf: 'flex-start' }}>My profile <ArrowForwardIcon sx={{ ml: 1, fontSize: 18 }} /></Button>
      </Stack>
      <Box component="form" onSubmit={(event) => { event.preventDefault(); setLocation(region); setAppliedQuery(query.trim()); }} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' }, gap: 1.5, py: 2.5, borderTop: 1, borderBottom: 1, borderColor: 'divider', mb: 4 }}>
        <TextField label="Search" placeholder="Conference, technology, community..." value={query} onChange={(event) => setQuery(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
        <Autocomplete freeSolo options={[...new Set(['India', 'New Delhi, India', ...(data?.regions ?? [])])]} inputValue={region} onInputChange={(_event, value) => setRegion(value)} renderInput={(params) => <TextField {...params} label="City or country" placeholder="All locations" />} />
        <Button type="submit" variant="contained" startIcon={<SearchIcon />}>Search</Button>
      </Box>
      {!location && !appliedQuery && tab === 'events' && <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}><Typography variant="h5">Community spotlight</Typography><Button size="small" onClick={() => setTab('communities')} endIcon={<ArrowForwardIcon />}>All communities</Button></Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>{communityDirectory.slice(0, 2).map((community) => <CommunityCard key={community.url} community={community} />)}</Box>
      </Box>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 260px' }, gap: 4 }}>
        <Box sx={{ minWidth: 0 }}>
          <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}><Tab value="events" label="Upcoming events" /><Tab value="communities" label="Communities" /><Tab value="saved" label={`Saved (${saved.length})`} /></Tabs>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">{location || 'All locations'}{!loading && ` / ${tab === 'communities' ? communities.length : events.length} results`}</Typography>
            <Stack direction="row" alignItems="center" gap={1}>{(location || appliedQuery) && <Button size="small" onClick={clearFilters}>Clear filters</Button>}<Tooltip title="Reload listings"><span><IconButton aria-label="Reload listings" onClick={() => setRefresh((value) => value + 1)} disabled={loading}><RefreshIcon /></IconButton></span></Tooltip></Stack>
          </Stack>
          {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => setRefresh((value) => value + 1)}>Retry</Button>}>{error}</Alert>}
          {tab === 'events' && data?.status !== 'live' && !loading && data && <Alert severity="warning" sx={{ mb: 2 }}>{data.status === 'stale' ? 'The source is temporarily unavailable. Showing the last fetched listings.' : 'The live source is unavailable. No demo events have been substituted.'}</Alert>}
          {tab === 'communities' ? <>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>Curated directory / Source: Commudle / Reviewed {directoryReviewedAt}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>{communities.map((community) => <CommunityCard key={community.url} community={community} />)}</Box>
            {!communities.length && <Alert severity="info">No curated communities match this region yet. <Button onClick={clearFilters}>Browse all communities</Button></Alert>}
          </> : loading && tab === 'events' ? <Stack spacing={2}>{[1, 2, 3].map((item) => <Skeleton key={item} variant="rounded" height={170} />)}</Stack> : <Stack spacing={2}>
            {events.map((event) => <Card key={event.id} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', gap: 2, boxShadow: 'none' }}>
              <Box sx={{ width: 64, flexShrink: 0, textAlign: 'center', alignSelf: 'flex-start', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}><Typography sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', py: 0.5, fontSize: 12, fontWeight: 800 }}>{new Date(event.startsAt).toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }).toUpperCase()}</Typography><Typography sx={{ py: 0.5, fontSize: 26, fontWeight: 800 }}>{new Date(event.startsAt).getUTCDate()}</Typography></Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="overline" color="primary.main">{new Date(event.startsAt).getUTCFullYear()} / CONFERENCE & MEETUP</Typography><Typography variant="h5" sx={{ mb: 1 }}>{event.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{event.location}</Typography><Typography variant="caption" color="text.secondary">{dateLabel(event.startsAt)}{event.endsAt !== event.startsAt ? ` - ${dateLabel(event.endsAt)}` : ''}</Typography>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}><Button component="a" href={event.url} target="_blank" rel="noopener noreferrer" size="small" endIcon={<ArrowOutwardIcon />} sx={{ px: 0 }}>Organizer website</Button><Tooltip title={saved.some((item) => item.id === event.id) ? 'Remove saved event' : 'Save event'}><IconButton aria-label={saved.some((item) => item.id === event.id) ? `Unsave ${event.name}` : `Save ${event.name}`} onClick={() => toggleSaved(event)} color="primary">{saved.some((item) => item.id === event.id) ? <BookmarkIcon /> : <BookmarkBorderIcon />}</IconButton></Tooltip></Stack>
              </Box>
            </Card>)}
            {!events.length && <Box sx={{ py: 5, textAlign: 'center', borderBottom: 1, borderColor: 'divider' }}><PublicIcon color="action" sx={{ fontSize: 36, mb: 1 }} /><Typography variant="h6">{tab === 'saved' ? 'No saved events here yet' : 'No upcoming listings for this search'}</Typography><Button sx={{ mt: 1 }} onClick={clearFilters}>Explore all locations</Button></Box>}
          </Stack>}
        </Box>
        <Box component="aside" sx={{ borderLeft: { lg: 1 }, borderColor: { lg: 'divider' }, pl: { lg: 3 }, pt: 1 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Your community space</Typography>
          {[{ title: 'Recommended for you', subtitle: 'AI picks from this workspace', href: '/for-you' }, { title: 'Meet collaborators', subtitle: 'People & teams', href: '/people' }, { title: 'Publish an event', subtitle: 'Organizer workspace', href: '/events' }, { title: 'Start a community', subtitle: 'Community workspace', href: '/communities' }].map((item) => <Button key={item.href} component={Link} href={item.href} fullWidth sx={{ justifyContent: 'space-between', textAlign: 'left', px: 0, py: 1.5 }} endIcon={<ArrowForwardIcon />}><Box><Typography variant="body2" fontWeight={700}>{item.title}</Typography><Typography variant="caption" color="text.secondary">{item.subtitle}</Typography></Box></Button>)}
          <Divider sx={{ my: 3 }} /><Typography variant="overline" fontWeight={800}>Listing sources</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Events: Developers.events public feed. Communities: curated public directory.</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>{data?.fetchedAt ? `Events fetched ${new Date(data.fetchedAt).toLocaleString()}` : 'Awaiting event source'}</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>Coverage varies by region. Confirm dates, tickets and availability with the organizer.</Typography>
          <Button component="a" href="https://developers.events" target="_blank" rel="noopener noreferrer" size="small" endIcon={<ArrowOutwardIcon />} sx={{ mt: 1, px: 0 }}>View event source</Button>
        </Box>
      </Box>
    </Box>
  );
}