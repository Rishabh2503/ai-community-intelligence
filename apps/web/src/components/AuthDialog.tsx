'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useApp } from './Providers';

const DEMO_ACCOUNTS = [
  { email: 'aarav@communityspace.dev', role: 'Organizer' },
  { email: 'rohan@communityspace.dev', role: 'Student member' },
  { email: 'sara@communityspace.dev', role: 'Admin / moderator' },
];

export function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, register } = useApp();
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (tab === 0) await login(form.email, form.password);
      else await register({ name: form.name, email: form.email, password: form.password });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>Welcome to Community Space</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
          <Tab label="Sign in" />
          <Tab label="Create account" />
        </Tabs>

        <Stack spacing={2}>
          {tab === 1 && (
            <TextField
              label="Full name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              fullWidth
            />
          )}
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button variant="contained" onClick={submit} disabled={busy} size="large">
            {busy ? 'Please wait…' : tab === 0 ? 'Sign in' : 'Create account'}
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }}>
          <Typography variant="caption" color="text.secondary">
            demo accounts — click one to fill in
          </Typography>
        </Divider>

        <Stack spacing={1}>
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              fullWidth
              variant="outlined"
              onClick={() => setForm({ ...form, email: account.email, password: 'password123' })}
              sx={{ justifyContent: 'space-between', textTransform: 'none', px: 1.5, borderRadius: 2 }}
            >
              <Typography variant="body2" fontWeight={600}>
                {account.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {account.role}
              </Typography>
            </Button>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5, textAlign: 'center' }}>
          password for every demo account: <strong>password123</strong>
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
