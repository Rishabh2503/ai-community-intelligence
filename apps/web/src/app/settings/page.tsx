'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { api } from '../../lib/api';
import { usePreferredLocation } from '../../lib/location';
import { useApp } from '../../components/Providers';
import { PageHeader } from '../../components/ui';

const AVAILABILITY = ['OPEN', 'BUSY', 'HIRING', 'LOOKING_FOR_TEAM'];
const splitList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export default function SettingsPage() {
  const { user, notify } = useApp();
  const { setLocation: rememberLocation } = usePreferredLocation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    headline: '', bio: '', location: '', availability: 'OPEN', skills: '', interests: '', expertise: '', experienceYrs: 0,
  });

  useEffect(() => {
    if (!user) return;
    void api.auth.me().then(({ profile }) => {
      if (!profile) return;
      setForm({
        headline: profile.headline,
        bio: profile.bio,
        location: profile.location,
        availability: profile.availability,
        skills: profile.skills.join(', '),
        interests: profile.interests.join(', '),
        expertise: profile.expertise.join(', '),
        experienceYrs: profile.experienceYrs,
      });
    }).catch((error) => notify(error instanceof Error ? error.message : 'Could not load your profile', 'error'));
  }, [user, notify]);

  const save = async () => {
    setSaving(true);
    try {
      await api.profiles.updateMine({
        headline: form.headline,
        bio: form.bio,
        location: form.location,
        availability: form.availability,
        skills: splitList(form.skills),
        interests: splitList(form.interests),
        expertise: splitList(form.expertise),
        experienceYrs: Number(form.experienceYrs),
      });
      rememberLocation(form.location);
      notify('Preferences saved. Discovery will now use your region and interests.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save your preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900 }}>
      <PageHeader title="My preferences" subtitle="Keep these current to improve nearby events, communities, recommendations, and teammate matches." />
      {!user ? (
        <Card><CardContent><Typography>Sign in to create and update your discovery profile.</Typography></CardContent></Card>
      ) : (
        <Card sx={{ '&:hover': { transform: 'none' } }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack spacing={2.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth label="Location or region" placeholder="Pune, India" value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  InputProps={{ startAdornment: <LocationOnIcon color="action" sx={{ mr: 1 }} /> }}
                />
                <TextField
                  select fullWidth label="Availability" value={form.availability}
                  onChange={(event) => setForm({ ...form, availability: event.target.value })}
                >
                  {AVAILABILITY.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                </TextField>
              </Stack>
              <TextField fullWidth label="Headline" value={form.headline} onChange={(event) => setForm({ ...form, headline: event.target.value })} />
              <TextField fullWidth multiline minRows={4} label="About you" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
              <TextField fullWidth label="Skills" helperText="Comma separated" value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} />
              <TextField fullWidth label="Interests" helperText="Comma separated" value={form.interests} onChange={(event) => setForm({ ...form, interests: event.target.value })} />
              <TextField fullWidth label="Areas of expertise" helperText="Comma separated" value={form.expertise} onChange={(event) => setForm({ ...form, expertise: event.target.value })} />
              <TextField type="number" label="Years of experience" value={form.experienceYrs} onChange={(event) => setForm({ ...form, experienceYrs: Number(event.target.value) })} inputProps={{ min: 0, max: 60 }} sx={{ maxWidth: 220 }} />
              <Button variant="contained" startIcon={<SaveIcon />} onClick={save} disabled={saving} sx={{ alignSelf: 'flex-start' }}>
                {saving ? 'Saving...' : 'Save preferences'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}