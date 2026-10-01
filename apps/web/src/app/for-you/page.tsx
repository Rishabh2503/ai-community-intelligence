'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/ArrowForward';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { api, type EventItem, type SearchHit } from '../../lib/api';
import { usePreferredLocation } from '../../lib/location';
import { useApp } from '../../components/Providers';
import { CardGrid, EmptyState, LoadingCards, PageHeader, ResultCard, StatCard, TagList } from '../../components/ui';

const INTENT_PRESETS = [
  'I want to learn retrieval augmented generation',
  'Find me a hackathon team in Pune',
  'Kubernetes cost optimisation help',
  'Accessibility and design systems',
];

/**
 * AI recommendations over content published inside this workspace.
 * Public real-world listings live on the Discover hub instead.
 */
export default function ForYouPage() {
  const { user, notify } = useApp();
  const { location, setLocation } = usePreferredLocation();
  const [region, setRegion] = useState('');
  const [intent, setIntent] = useState('');
  const [basis, setBasis] = useState('');
  const [items, setItems] = useState<SearchHit[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ communities: 0, events: 0, resources: 0, members: 0 });

  const loadRecommendations = useCallback(
    async (value?: string) => {
      setLoading(true);
      try {
        const result = await api.ai.recommendations(value ?? undefined);
        setItems(result.items);
        setBasis(result.basis);
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not load recommendations', 'error');
      } finally {
        setLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    void loadRecommendations();
    void api.analytics
      .organizer()
      .then((data) =>
        setStats({
          communities: data.totals.communities,
          events: data.totals.events,
          resources: data.totals.resources,
          members: data.totals.members,
        }),
      )
      .catch(() => undefined);
  }, [loadRecommendations]);

  useEffect(() => {
    setRegion(location);
    void api.events
      .list({ upcoming: 'true', location })
      .then((result) => setEvents(result.items.slice(0, 3)))
      .catch(() => undefined);
  }, [location]);

  return (
    <Box>
      <Card
        sx={{
          mb: 4,
          p: { xs: 3, md: 5 },
          background: 'linear-gradient(135deg, rgba(15,118,110,0.14), rgba(37,99,235,0.1))',
          border: 'none',
          '&:hover': { transform: 'none', boxShadow: 'none' },
        }}
      >
        <Chip icon={<AutoAwesomeIcon />} label="AI-powered discovery" color="primary" sx={{ mb: 2 }} />
        <Typography variant="h1" gutterBottom>
          {user ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Find your people, events and knowledge.'}
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720, mb: 3 }}>
          Describe what you are looking for in plain language. Community Space blends your intent with your skills and
          your activity to recommend events, communities, resources and collaborators published here.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ maxWidth: 780 }}>
          <TextField
            fullWidth
            size="medium"
            placeholder="e.g. I want to build a RAG assistant and need teammates"
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && loadRecommendations(intent)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AutoAwesomeIcon color="primary" />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="contained" size="large" endIcon={<SendIcon />} onClick={() => loadRecommendations(intent)}>
            Recommend
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2, maxWidth: 400 }}>
          <TextField
            fullWidth
            size="small"
            label="Your region"
            placeholder="e.g. Bengaluru, India"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LocationOnIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="outlined" onClick={() => setLocation(region)}>
            Apply
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          {INTENT_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={preset}
              variant="outlined"
              onClick={() => {
                setIntent(preset);
                void loadRecommendations(preset);
              }}
            />
          ))}
        </Stack>
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 4 }}>
        <StatCard label="Communities" value={stats.communities} />
        <StatCard label="Events" value={stats.events} />
        <StatCard label="Resources" value={stats.resources} />
        <StatCard label="Members" value={stats.members} />
      </Box>

      <PageHeader
        title="Recommended for you"
        subtitle={basis ? `Ranked using ${basis}.` : undefined}
        action={
          <Button component={Link} href="/search" variant="outlined">
            Open semantic search
          </Button>
        }
      />

      {loading ? (
        <LoadingCards />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing to recommend yet" hint="Publish some events or resources, then try again." />
      ) : (
        <CardGrid>
          {items.map((hit) => (
            <ResultCard key={`${hit.entityType}-${hit.entityId}`} hit={hit} />
          ))}
        </CardGrid>
      )}

      <PageHeader
        title={location ? `Published near ${location}` : 'Published here soon'}
        subtitle={
          location
            ? 'Upcoming workspace events matched to your preferred region.'
            : 'Upcoming events published inside this workspace.'
        }
        action={
          <Button component={Link} href="/" variant="outlined">
            Browse real-world listings
          </Button>
        }
      />
      {events.length === 0 ? (
        <EmptyState title="No workspace events yet" hint="Publish an event, or browse real-world listings on Discover." />
      ) : (
        <CardGrid>
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent>
                <Chip size="small" color="primary" variant="outlined" label={event.mode} />
                <Typography variant="h5" sx={{ mt: 1 }}>
                  {event.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(event.startsAt).toLocaleString()} · {event.venue}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  {event.summary || event.description.slice(0, 180)}
                </Typography>
                <TagList tags={event.tags} />
                <Button component={Link} href="/events" size="small" sx={{ mt: 2 }}>
                  View all events
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardGrid>
      )}
    </Box>
  );
}
