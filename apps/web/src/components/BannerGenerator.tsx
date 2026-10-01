'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Autorenew';
import ImageIcon from '@mui/icons-material/Image';
import { api, type BannerStyle } from '../lib/api';
import { useApp } from './Providers';

/**
 * AI banner generator for events and announcements.
 *
 * The image comes from a keyless open-source endpoint, so the feature works
 * with no account and no configuration. Generated images deliberately contain
 * no text - the real title is overlaid by the UI, which avoids the garbled
 * lettering that image models produce.
 */
export function BannerGenerator({
  description,
  value,
  onChange,
  title,
}: {
  description: string;
  value: string;
  onChange: (url: string) => void;
  title?: string;
}) {
  const { notify } = useApp();
  const [styles, setStyles] = useState<BannerStyle[]>([]);
  const [style, setStyle] = useState('TECH');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    void api.ai
      .bannerStyles()
      .then(setStyles)
      .catch(() => setStyles([]));
  }, []);

  const generate = async (newSeed = true) => {
    const brief = (prompt.trim() || description.trim()).slice(0, 400);
    if (brief.length < 3) {
      notify('Write an event description first, or describe the banner you want.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const result = await api.ai.banner(brief, style, newSeed ? undefined : 1);
      setImageLoading(true);
      onChange(result.imageUrl);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not generate a banner', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2, borderRadius: 2, border: (theme) => `1px dashed ${theme.palette.divider}` }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <ImageIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={800}>
          AI event banner
        </Typography>
        <Chip size="small" label="no API key needed" variant="outlined" color="secondary" />
      </Stack>

      <TextField
        size="small"
        fullWidth
        multiline
        minRows={2}
        label="Describe the banner (optional)"
        placeholder="Leave blank to generate from the event description"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        sx={{ mb: 1.5 }}
      />

      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        {styles.map((item) => (
          <Chip
            key={item.id}
            size="small"
            label={item.label}
            color={style === item.id ? 'primary' : 'default'}
            variant={style === item.id ? 'filled' : 'outlined'}
            onClick={() => setStyle(item.id)}
          />
        ))}
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          size="small"
          startIcon={loading ? <CircularProgress size={15} color="inherit" /> : <AutoAwesomeIcon />}
          onClick={() => generate(true)}
          disabled={loading}
        >
          {value ? 'Regenerate' : 'Generate banner'}
        </Button>
        {value && (
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => generate(true)} disabled={loading}>
            Another variation
          </Button>
        )}
        {value && (
          <Button size="small" color="inherit" onClick={() => onChange('')} disabled={loading}>
            Remove
          </Button>
        )}
      </Stack>

      {value && (
        <Box
          sx={{
            mt: 2,
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            aspectRatio: '1200 / 630',
            bgcolor: 'action.hover',
          }}
        >
          {imageLoading && (
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={1}
              sx={{ position: 'absolute', inset: 0, zIndex: 1 }}
            >
              <CircularProgress size={26} />
              <Typography variant="caption" color="text.secondary">
                Painting your banner…
              </Typography>
            </Stack>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="AI generated event banner"
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              notify('The image service did not respond. Try generating again.', 'warning');
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {title && !imageLoading && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'flex-end',
                p: 2,
                background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 55%)',
              }}
            >
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, lineHeight: 1.2 }}>
                {title}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
