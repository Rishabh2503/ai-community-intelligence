'use client';

import type { ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { entityStyle } from '../theme/theme';
import type { SearchHit } from '../lib/api';

/**
 * Reusable presentation components.
 *
 * Every page renders results through these, so a match score, an AI summary or
 * a section header looks identical everywhere (DRY + a consistent design
 * language). Pages stay focused on data fetching and layout.
 */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography variant="h2" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

export function EntityChip({ type }: { type: string }) {
  const style = entityStyle[type] ?? { label: type, color: 'default' as const };
  return <Chip size="small" label={style.label} color={style.color} variant="outlined" />;
}

export function MatchScore({ value, label = 'match' }: { value: number; label?: string }) {
  const color = value >= 70 ? 'success' : value >= 45 ? 'warning' : 'error';
  return (
    <Tooltip title="Blended score: vector similarity + keyword overlap">
      <Box sx={{ minWidth: 92 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="caption" fontWeight={800} color={`${color}.main`}>
            {value}%
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={value} color={color} sx={{ mt: 0.5 }} />
      </Box>
    </Tooltip>
  );
}

export function AiSummary({ text, title = 'AI summary' }: { text: string; title?: string }) {
  if (!text) return null;
  return (
    <Box
      sx={{
        mt: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: (theme) => (theme.palette.mode === 'light' ? 'rgba(15,118,110,0.06)' : 'rgba(15,118,110,0.16)'),
        border: (theme) => `1px dashed ${theme.palette.primary.main}55`,
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
        <AutoAwesomeIcon sx={{ fontSize: 15, color: 'primary.main' }} />
        <Typography variant="caption" fontWeight={800} color="primary.main">
          {title}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
        {text}
      </Typography>
    </Box>
  );
}

export function TagList({ tags, max = 5 }: { tags: string[]; max?: number }) {
  if (!tags?.length) return null;
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
      {tags.slice(0, max).map((tag) => (
        <Chip key={tag} label={tag} size="small" variant="filled" sx={{ bgcolor: 'action.hover' }} />
      ))}
      {tags.length > max && <Chip size="small" label={`+${tags.length - max}`} variant="outlined" />}
    </Stack>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Card>
  );
}

export function LoadingCards({ count = 6 }: { count?: number }) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' } }}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} variant="rounded" height={190} />
      ))}
    </Box>
  );
}

/** Uniform card for any semantic search / recommendation hit. */
export function ResultCard({ hit, footer }: { hit: SearchHit; footer?: ReactNode }) {
  const metadata = hit.metadata ?? {};
  const contextLine = [metadata.communityName, metadata.venue, metadata.location, metadata.headline]
    .filter((value) => typeof value === 'string' && value)
    .slice(0, 2)
    .join(' · ');

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box sx={{ minWidth: 0 }}>
            <EntityChip type={hit.entityType} />
            <Typography variant="h5" sx={{ mt: 1 }}>
              {hit.title}
            </Typography>
            {contextLine && (
              <Typography variant="caption" color="text.secondary">
                {contextLine}
              </Typography>
            )}
          </Box>
          <MatchScore value={hit.matchPercentage} />
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {hit.snippet}
        </Typography>

        {hit.reasons?.length > 0 && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            {hit.reasons.slice(0, 3).map((reason) => (
              <Chip key={reason} size="small" label={reason} color="secondary" variant="outlined" />
            ))}
          </Stack>
        )}

        {Array.isArray(metadata.tags) && <TagList tags={metadata.tags as string[]} />}
        {footer}
      </CardContent>
    </Card>
  );
}

export function CardGrid({ children, columns = 3 }: { children: ReactNode; columns?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: '1fr',
          md: 'repeat(2, minmax(0, 1fr))',
          xl: `repeat(${columns}, minmax(0, 1fr))`,
        },
      }}
    >
      {children}
    </Box>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h3" fontWeight={800}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
