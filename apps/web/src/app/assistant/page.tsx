'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import HubIcon from '@mui/icons-material/Hub';
import PublicIcon from '@mui/icons-material/Public';
import { api, type AssistantAnswer } from '../../lib/api';
import { useApp } from '../../components/Providers';
import { LiveDataPanel } from '../../components/LiveDataPanel';
import { EntityChip, MatchScore, PageHeader } from '../../components/ui';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  answer?: AssistantAnswer;
  /** Set when the turn was answered through the Cognee knowledge graph. */
  via?: { label: string; fellBack: boolean; latencyMs: number };
}

const STARTERS = [
  'When is the winter hackathon and what are the team rules?',
  'What resources explain RAG chunking strategies?',
  'Who should I talk to about Kubernetes cost optimisation?',
  'How does the CKA study group work?',
];

/**
 * Conversation-based discovery interface backed by the RAG endpoint.
 * Every answer shows its sources so members can verify the information.
 */
export default function AssistantPage() {
  const { notify } = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [useCognee, setUseCognee] = useState(false);
  const [cogneeReady, setCogneeReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.cognee
      .status()
      .then((status) => setCogneeReady(status.configured))
      .catch(() => setCogneeReady(false));
  }, []);

  const ask = async (value = question) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;

    setTurns((current) => [...current, { role: 'user', content: trimmed }]);
    setQuestion('');
    setLoading(true);

    try {
      if (useCognee) {
        const result = await api.cognee.ask(trimmed);
        setTurns((current) => [
          ...current,
          {
            role: 'assistant',
            content: result.answer,
            answer: result.sources
              ? ({
                  question: trimmed,
                  answer: result.answer,
                  sources: result.sources,
                  followUps: [],
                  provider: result.source,
                  latencyMs: result.latencyMs,
                  grounded: result.grounded ?? false,
                } as AssistantAnswer)
              : undefined,
            via: {
              label: result.fellBack ? 'Cognee unavailable — built-in RAG' : `Cognee · ${result.searchType}`,
              fellBack: result.fellBack,
              latencyMs: result.latencyMs,
            },
          },
        ]);
        if (result.fellBack) notify('Cognee was unreachable, answered with the built-in assistant.', 'warning');
      } else {
        const answer = await api.ai.assistant(trimmed);
        setTurns((current) => [...current, { role: 'assistant', content: answer.answer, answer }]);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The assistant could not answer', 'error');
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Community knowledge assistant"
        subtitle="Retrieval augmented generation over every published event, resource, announcement, discussion and profile. Answers are grounded in retrieved passages and always cite their sources."
      />

      <LiveDataPanel />

      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Tooltip
          title={
            cogneeReady
              ? 'Answer using the Cognee knowledge graph instead of local vector retrieval'
              : 'Add COGNEE_API_KEY and COGNEE_BASE_URL to apps/api/.env to enable this'
          }
        >
          <span>
            <Button
              size="small"
              startIcon={<HubIcon />}
              variant={useCognee ? 'contained' : 'outlined'}
              color={useCognee ? 'secondary' : 'primary'}
              disabled={!cogneeReady}
              onClick={() => setUseCognee((current) => !current)}
              sx={{ borderRadius: 999 }}
            >
              {useCognee ? 'Cognee graph memory: ON' : 'Try with Cognee graph memory'}
            </Button>
          </span>
        </Tooltip>

        <Typography variant="caption" color="text.secondary">
          {cogneeReady
            ? useCognee
              ? 'Questions are routed to Cognee; if it fails the built-in assistant answers instead.'
              : 'Using built-in hybrid retrieval.'
            : 'Cognee not configured — built-in retrieval active.'}
        </Typography>
      </Stack>

      <Card sx={{ '&:hover': { transform: 'none', boxShadow: 'none' } }}>
        <CardContent sx={{ minHeight: 420 }}>
          {turns.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <AutoAwesomeIcon sx={{ fontSize: 44, color: 'primary.main', mb: 1 }} />
              <Typography variant="h5" gutterBottom>
                Ask about anything the community has published
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                No more scrolling through months of chat history.
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                {STARTERS.map((starter) => (
                  <Chip key={starter} label={starter} variant="outlined" onClick={() => ask(starter)} />
                ))}
              </Stack>
            </Box>
          )}

          <Stack spacing={2}>
            {turns.map((turn, index) => (
              <Stack key={index} direction="row" spacing={1.5} alignItems="flex-start">
                <Avatar sx={{ bgcolor: turn.role === 'user' ? 'grey.500' : 'primary.main', width: 34, height: 34 }}>
                  {turn.role === 'user' ? <PersonIcon fontSize="small" /> : <AutoAwesomeIcon fontSize="small" />}
                </Avatar>
                <Box
                  sx={{
                    flex: 1,
                    p: 2,
                    borderRadius: 3,
                    bgcolor: turn.role === 'user' ? 'action.hover' : 'transparent',
                    border: (theme) => (turn.role === 'assistant' ? `1px solid ${theme.palette.divider}` : 'none'),
                  }}
                >
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                    {turn.content}
                  </Typography>

                  {turn.via && (
                    <Chip
                      size="small"
                      icon={<HubIcon />}
                      label={`${turn.via.label} · ${turn.via.latencyMs} ms`}
                      color={turn.via.fellBack ? 'warning' : 'secondary'}
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  )}

                  {turn.answer?.answerMode === 'general' && (
                    <Chip
                      size="small"
                      icon={<PublicIcon />}
                      label="General knowledge — not from your community"
                      color="info"
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  )}

                  {turn.answer && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="caption" fontWeight={800} color="text.secondary">
                          {turn.answer.answerMode === 'general' ? 'ANSWERED OUTSIDE THE KNOWLEDGE BASE' : 'SOURCES'}
                        </Typography>
                        {turn.answer.answerMode !== 'general' && (
                          <Chip
                            size="small"
                            label={turn.answer.grounded ? 'grounded' : 'low confidence'}
                            color={turn.answer.grounded ? 'success' : 'warning'}
                            variant="outlined"
                          />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {turn.answer.provider} · {turn.answer.latencyMs} ms
                        </Typography>
                      </Stack>

                      <Stack spacing={1}>
                        {turn.answer.sources.map((source) => (
                          <Stack
                            key={`${source.entityType}-${source.entityId}`}
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                            sx={{ p: 1, borderRadius: 2, bgcolor: 'action.hover' }}
                          >
                            <EntityChip type={source.entityType} />
                            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                              {source.title}
                            </Typography>
                            <MatchScore value={source.matchPercentage} label="relevance" />
                          </Stack>
                        ))}
                      </Stack>

                      {turn.answer.followUps.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                          {turn.answer.followUps.map((followUp) => (
                            <Chip key={followUp} size="small" label={followUp} onClick={() => ask(followUp)} />
                          ))}
                        </Stack>
                      )}
                    </>
                  )}
                </Box>
              </Stack>
            ))}
            {loading && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Retrieving relevant passages…
                </Typography>
              </Stack>
            )}
            <div ref={bottomRef} />
          </Stack>
        </CardContent>

        <Divider />
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            size="medium"
            placeholder="Ask a question about the community…"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && ask()}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button variant="contained" endIcon={<SendIcon />} onClick={() => ask()} disabled={loading}>
                    Ask
                  </Button>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Card>
    </Box>
  );
}
