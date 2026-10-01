'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '../lib/api';
import { useApp } from './Providers';

const REASONS = [
  { value: 'MISLEADING', label: 'Misleading or inaccurate' },
  { value: 'DUPLICATE', label: 'Duplicate of existing content' },
  { value: 'SPAM', label: 'Spam or promotion' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate content' },
  { value: 'OTHER', label: 'Something else' },
];

/**
 * One reporting dialog reused by every content type, so moderation works
 * identically across events, resources, posts and profiles (DRY).
 */
export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetTitle,
}: {
  open: boolean;
  onClose: () => void;
  targetType: string;
  targetId: string;
  targetTitle: string;
}) {
  const { notify, user } = useApp();
  const [reason, setReason] = useState('MISLEADING');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const report = await api.moderation.report({ targetType, targetId, targetTitle, reason, details });
      notify(`Report filed. AI triage: ${report.aiVerdict.replace(/_/g, ' ').toLowerCase()}.`, 'success');
      setDetails('');
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not file the report', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Report content</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Reporting “{targetTitle}”. Moderators see an AI triage verdict with the report, including automatic
            near-duplicate detection.
          </Typography>
          <TextField select label="Reason" value={reason} onChange={(event) => setReason(event.target.value)}>
            {REASONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Details (optional)"
            multiline
            minRows={3}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
          {!user && (
            <Typography variant="caption" color="error">
              You need to sign in to submit a report.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={submit} disabled={busy || !user}>
          Submit report
        </Button>
      </DialogActions>
    </Dialog>
  );
}
