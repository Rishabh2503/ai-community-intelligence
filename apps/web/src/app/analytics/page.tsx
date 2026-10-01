'use client';

import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Chip, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { api, type OrganizerAnalytics } from '../../lib/api';
import { EmptyState, PageHeader, StatCard } from '../../components/ui';
import { RequireRole } from '../../components/RequireRole';
import { ROUTE_ROLES } from '../../lib/access';

/** Organizers and admins only - members never see engagement data. */
export default function AnalyticsRoute() {
  return (
    <RequireRole roles={ROUTE_ROLES['/analytics']}>
      <AnalyticsDashboard />
    </RequireRole>
  );
}

/**
 * Organizer analytics: engagement over time, top events, skill supply and -
 * most valuable for organizers - what members keep asking the assistant about.
 */
function AnalyticsDashboard() {
  const [data, setData] = useState<OrganizerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.analytics
      .organizer()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;
  if (!data) return <EmptyState title="No analytics available" />;

  const actions = Object.entries(data.engagement.byAction);
  const maxSkill = Math.max(...data.skillSupply.map((skill) => skill.count), 1);

  return (
    <Box>
      <PageHeader
        title="Organizer analytics"
        subtitle="Engagement signals, content inventory and the questions members ask most — so organizers know what to publish next."
      />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(6, 1fr)' }, mb: 4 }}>
        <StatCard label="Communities" value={data.totals.communities} />
        <StatCard label="Events" value={data.totals.events} />
        <StatCard label="Resources" value={data.totals.resources} />
        <StatCard label="Announcements" value={data.totals.announcements} />
        <StatCard label="Members" value={data.totals.members} />
        <StatCard label="Indexed chunks" value={data.totals.indexedChunks} hint="vector search index" />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, mb: 4 }}>
        <Card sx={{ '&:hover': { transform: 'none', boxShadow: 'none' } }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Engagement (last 14 days)
            </Typography>
            <LineChart
              height={280}
              xAxis={[{ scaleType: 'point', data: data.engagement.daily.map((point) => point.date.slice(5)) }]}
              series={[
                {
                  data: data.engagement.daily.map((point) => point.count),
                  label: 'Interactions',
                  area: true,
                  color: '#4F46E5',
                  showMark: false,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card sx={{ '&:hover': { transform: 'none', boxShadow: 'none' } }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Interactions by type
            </Typography>
            {actions.length === 0 ? (
              <Typography color="text.secondary">No interactions recorded yet.</Typography>
            ) : (
              <BarChart
                height={280}
                xAxis={[{ scaleType: 'band', data: actions.map(([action]) => action) }]}
                series={[{ data: actions.map(([, count]) => count), color: '#0EA5E9' }]}
              />
            )}
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mb: 4 }}>
        <Card sx={{ '&:hover': { transform: 'none', boxShadow: 'none' } }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Frequently requested information
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Topics extracted from assistant questions. High-volume topics with few resources are publishing
              opportunities.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              {data.knowledgeDemand.topTopics.map((topic) => (
                <Chip key={topic.topic} label={`${topic.topic} · ${topic.count}`} color="primary" variant="outlined" />
              ))}
            </Stack>

            {data.knowledgeDemand.unansweredSignals.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" fontWeight={800} color="warning.main">
                  CONTENT GAPS — asked about, but little published
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {data.knowledgeDemand.unansweredSignals.map((signal) => (
                    <Chip key={signal} label={signal} color="warning" size="small" />
                  ))}
                </Stack>
              </>
            )}

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" fontWeight={800} color="text.secondary">
              RECENT QUESTIONS
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {data.knowledgeDemand.recentQuestions.map((item, index) => (
                <Typography key={index} variant="body2" color="text.secondary">
                  • {item.question}
                </Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ '&:hover': { transform: 'none', boxShadow: 'none' } }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Skill supply in the community
            </Typography>
            <Stack spacing={1.25} sx={{ mt: 2 }}>
              {data.skillSupply.map((skill) => (
                <Box key={skill.skill}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">{skill.skill}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {skill.count}
                    </Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={(skill.count / maxSkill) * 100} />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
        <Card sx={{ '&:hover': { transform: 'none', boxShadow: 'none' } }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Top events by engagement
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {data.engagement.topEvents.map((event) => (
                <Stack key={event.id} direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {event.title}
                  </Typography>
                  <Chip size="small" label={`${event.rsvps} RSVPs`} color="primary" variant="outlined" />
                  <Chip size="small" label={`${event.interactions} views`} variant="outlined" />
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ '&:hover': { transform: 'none', boxShadow: 'none' } }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Moderation health
            </Typography>
            <Typography variant="h2" fontWeight={800} color={data.moderation.openCount > 0 ? 'warning.main' : 'success.main'}>
              {data.moderation.openCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              open reports awaiting review
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              {Object.entries(data.moderation.byStatus).map(([status, count]) => (
                <Chip key={status} size="small" label={`${status}: ${count}`} variant="outlined" />
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
