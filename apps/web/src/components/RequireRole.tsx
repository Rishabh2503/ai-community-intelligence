'use client';

import { useState, type ReactNode } from 'react';
import { Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/LockPerson';
import { useApp } from './Providers';
import { AuthDialog } from './AuthDialog';
import { describeRoles, type Role } from '../lib/access';

/**
 * Client-side route guard.
 *
 * This is defence in depth, not the security boundary - the API enforces the
 * same roles on every protected endpoint. Its job is to stop a signed-out
 * visitor or a member from ever seeing organizer/admin screens, including when
 * they type the URL directly.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, ready } = useApp();
  const [authOpen, setAuthOpen] = useState(false);

  // Avoids flashing "restricted" to an admin while the session is being read.
  if (!ready) return <LinearProgress />;

  if (user && roles.includes(user.role)) return <>{children}</>;

  const signedOut = !user;

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <Card sx={{ maxWidth: 520, width: '100%', '&:hover': { transform: 'none' } }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2} alignItems="flex-start">
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'action.hover',
                color: 'text.secondary',
              }}
            >
              <LockIcon />
            </Box>

            <Typography variant="h5" fontWeight={800}>
              {signedOut ? 'Sign in required' : 'Restricted area'}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {signedOut
                ? `This area is limited to ${describeRoles(roles)} accounts. Sign in to continue.`
                : `Your account is signed in as ${user.role.toLowerCase()}. This area is limited to ${describeRoles(
                    roles,
                  )} accounts.`}
            </Typography>

            {signedOut ? (
              <Button variant="contained" onClick={() => setAuthOpen(true)}>
                Sign in
              </Button>
            ) : (
              <Button variant="outlined" href="/">
                Back to Discover
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </Box>
  );
}
