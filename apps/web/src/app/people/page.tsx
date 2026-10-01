'use client';

import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { api, type MatchCandidate, type Profile, type ProjectItem } from '../../lib/api';
import { useApp } from '../../components/Providers';
import { CardGrid, EmptyState, LoadingCards, MatchScore, PageHeader, TagList } from '../../components/ui';

/**
 * People directory + AI teammate matching.
 * Tab 0: searchable member profiles (skills, interests, expertise).
 * Tab 1: describe a project and get ranked, explained collaborator matches.
 */
export default function PeoplePage() {
  const { notify } = useApp();
  const [tab, setTab] = useState(0);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', skills: '', availability: '' });

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [brief, setBrief] = useState({ description: '', skills: '' });
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [matching, setMatching] = useState(false);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const result = await api.profiles.list({
        q: filters.q || undefined,
        skills: filters.skills || undefined,
        availability: filters.availability || undefined,
      });
      setProfiles(result.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfiles();
    void api.projects.list().then((result) => setProjects(result.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runMatch = async () => {
    setMatching(true);
    try {
      const result = await api.ai.match(
        selectedProject
          ? { projectId: selectedProject, limit: 6 }
          : {
              description: brief.description,
              requiredSkills: brief.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
              limit: 6,
            },
      );
      setCandidates(result.candidates);
      if (result.candidates.length === 0) notify('No candidates found — try broader skills.', 'info');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Matching failed', 'error');
    } finally {
      setMatching(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="People & teams"
        subtitle="Searchable member profiles and AI collaborator matching that explains every suggestion."
      />

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
        <Tab label="Member directory" />
        <Tab label="Find teammates" />
      </Tabs>

      {tab === 0 && (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
            <TextField
              placeholder="Search by name, headline or bio"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              sx={{ flex: 1 }}
            />
            <TextField
              placeholder="Skills (comma separated)"
              value={filters.skills}
              onChange={(event) => setFilters({ ...filters, skills: event.target.value })}
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label="Availability"
              value={filters.availability}
              onChange={(event) => setFilters({ ...filters, availability: event.target.value })}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Any</MenuItem>
              <MenuItem value="OPEN">Open</MenuItem>
              <MenuItem value="LOOKING_FOR_TEAM">Looking for a team</MenuItem>
              <MenuItem value="HIRING">Hiring</MenuItem>
              <MenuItem value="BUSY">Busy</MenuItem>
            </TextField>
            <Button variant="contained" onClick={loadProfiles}>
              Search
            </Button>
          </Stack>

          {loading ? (
            <LoadingCards />
          ) : profiles.length === 0 ? (
            <EmptyState title="No members match those filters" />
          ) : (
            <CardGrid>
              {profiles.map((profile) => (
                <Card key={profile.userId}>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar src={profile.avatarUrl ?? undefined} sx={{ width: 52, height: 52 }}>
                        {profile.name[0]}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6">{profile.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {profile.headline}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Chip size="small" label={profile.availability.replace(/_/g, ' ')} color="primary" variant="outlined" />
                      <Chip size="small" label={`${profile.experienceYrs} yrs`} variant="outlined" />
                      <Chip size="small" label={profile.location} variant="outlined" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                      {profile.bio.slice(0, 160)}…
                    </Typography>
                    <TagList tags={profile.skills} />
                  </CardContent>
                </Card>
              ))}
            </CardGrid>
          )}
        </>
      )}

      {tab === 1 && (
        <>
          <Card sx={{ mb: 3, '&:hover': { transform: 'none', boxShadow: 'none' } }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Describe what you need
              </Typography>
              <Stack spacing={2}>
                <TextField
                  select
                  label="Match for an existing project (optional)"
                  value={selectedProject}
                  onChange={(event) => setSelectedProject(event.target.value)}
                >
                  <MenuItem value="">Use a free-form brief instead</MenuItem>
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.title}
                    </MenuItem>
                  ))}
                </TextField>

                {!selectedProject && (
                  <>
                    <TextField
                      label="Project brief"
                      multiline
                      minRows={3}
                      placeholder="We are building a mobile app that matches students into study groups…"
                      value={brief.description}
                      onChange={(event) => setBrief({ ...brief, description: event.target.value })}
                    />
                    <TextField
                      label="Required skills (comma separated)"
                      placeholder="React Native, UI Design, Node.js"
                      value={brief.skills}
                      onChange={(event) => setBrief({ ...brief, skills: event.target.value })}
                    />
                  </>
                )}

                <Button variant="contained" startIcon={<GroupAddIcon />} onClick={runMatch} disabled={matching}>
                  {matching ? 'Matching…' : 'Find collaborators'}
                </Button>
                {matching && <LinearProgress />}
              </Stack>
            </CardContent>
          </Card>

          {candidates.length === 0 ? (
            <EmptyState
              title="No matches yet"
              hint="Pick a project or write a brief. Scoring blends semantic similarity (55%), skill coverage (35%) and availability/experience (10%)."
            />
          ) : (
            <CardGrid columns={2}>
              {candidates.map((candidate) => (
                <Card key={candidate.profile.userId}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar src={candidate.profile.avatarUrl ?? undefined} sx={{ width: 48, height: 48 }}>
                          {candidate.profile.name[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="h6">{candidate.profile.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {candidate.profile.headline}
                          </Typography>
                        </Box>
                      </Stack>
                      <MatchScore value={candidate.matchPercentage} />
                    </Stack>

                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="caption" fontWeight={800} color="text.secondary">
                      WHY THIS MATCH
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {candidate.reasons.map((reason) => (
                        <Typography key={reason} variant="body2" color="text.secondary">
                          • {reason}
                        </Typography>
                      ))}
                    </Stack>

                    {candidate.matchedSkills.length > 0 && (
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                        {candidate.matchedSkills.map((skill) => (
                          <Chip key={skill} size="small" color="success" label={skill} />
                        ))}
                        {candidate.missingSkills.map((skill) => (
                          <Chip key={skill} size="small" color="error" variant="outlined" label={skill} />
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardGrid>
          )}
        </>
      )}
    </Box>
  );
}
