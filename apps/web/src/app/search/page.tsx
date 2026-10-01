'use client';

import { useState } from 'react';
import { Box, Button, Chip, InputAdornment, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/TravelExplore';
import { api, type SearchResponse } from '../../lib/api';
import { useApp } from '../../components/Providers';
import { CardGrid, EmptyState, LoadingCards, PageHeader, ResultCard } from '../../components/ui';

const TYPES = [
  { value: 'EVENT', label: 'Events' },
  { value: 'RESOURCE', label: 'Resources' },
  { value: 'ANNOUNCEMENT', label: 'Announcements' },
  { value: 'POST', label: 'Discussions' },
  { value: 'COMMUNITY', label: 'Communities' },
  { value: 'PROFILE', label: 'People' },
  { value: 'PROJECT', label: 'Projects' },
];

const EXAMPLES = [
  'Who can help me with Kubernetes costs?',
  'sessions about embeddings and vector search',
  'what do I need to know before the hackathon',
  'accessible component libraries',
];

/** Natural-language search over every indexed entity. */
export default function SearchPage() {
  const { notify } = useApp();
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (value = query) => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      setResult(await api.ai.search(value, types));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Semantic search"
        subtitle="Ask in your own words. Results are ranked by a hybrid of vector similarity and keyword overlap, and every card explains why it matched."
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="medium"
          placeholder="Ask anything about this community…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && run()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="primary" />
              </InputAdornment>
            ),
          }}
        />
        <Button variant="contained" size="large" onClick={() => run()} disabled={loading}>
          Search
        </Button>
      </Stack>

      <ToggleButtonGroup
        value={types}
        onChange={(_, value: string[]) => setTypes(value)}
        size="small"
        sx={{ flexWrap: 'wrap', mb: 2 }}
      >
        {TYPES.map((type) => (
          <ToggleButton key={type.value} value={type.value} sx={{ borderRadius: 999, px: 2, mr: 1, mb: 1, border: '1px solid' }}>
            {type.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
        {EXAMPLES.map((example) => (
          <Chip
            key={example}
            variant="outlined"
            label={example}
            onClick={() => {
              setQuery(example);
              void run(example);
            }}
          />
        ))}
      </Stack>

      {loading && <LoadingCards />}

      {!loading && result && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {result.hits.length} results for “{result.query}” in {result.tookMs} ms · embedding model {result.model}
          </Typography>
          {result.hits.length === 0 ? (
            <EmptyState title="No matches" hint="Try fewer filters or more descriptive wording." />
          ) : (
            <CardGrid>
              {result.hits.map((hit) => (
                <ResultCard key={`${hit.entityType}-${hit.entityId}`} hit={hit} />
              ))}
            </CardGrid>
          )}
        </>
      )}

      {!loading && !result && (
        <EmptyState
          title="Search the whole community at once"
          hint="Events, resources, announcements, discussions, communities, member profiles and open projects are all indexed."
        />
      )}
    </Box>
  );
}
