'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExploreIcon from '@mui/icons-material/Explore';
import SearchIcon from '@mui/icons-material/TravelExplore';
import ChatIcon from '@mui/icons-material/AutoAwesome';
import EventIcon from '@mui/icons-material/EventAvailable';
import GroupsIcon from '@mui/icons-material/Groups';
import LibraryIcon from '@mui/icons-material/LocalLibrary';
import PeopleIcon from '@mui/icons-material/Diversity3';
import ShieldIcon from '@mui/icons-material/Gavel';
import InsightsIcon from '@mui/icons-material/Insights';
import SettingsIcon from '@mui/icons-material/Tune';
import RecommendIcon from '@mui/icons-material/Recommend';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useApp } from './Providers';
import { AuthDialog } from './AuthDialog';
import { canAccess } from '../lib/access';

/**
 * Navigation is declared as data, not markup: the desktop sidebar, the mobile
 * drawer and the active-route highlight are all generated from this one list
 * (DRY - adding a page means adding one entry).
 *
 * Visibility comes from `canAccess`, which reads the same permission map the
 * page guards use, so restricted routes never appear in the menu.
 */
const NAV_ITEMS = [
  { href: '/', label: 'Discover', icon: <ExploreIcon /> },
  { href: '/for-you', label: 'Recommended', icon: <RecommendIcon /> },
  { href: '/search', label: 'Semantic Search', icon: <SearchIcon /> },
  { href: '/assistant', label: 'Knowledge Assistant', icon: <ChatIcon /> },
  { href: '/events', label: 'Events', icon: <EventIcon /> },
  { href: '/communities', label: 'Communities', icon: <GroupsIcon /> },
  { href: '/resources', label: 'Resources', icon: <LibraryIcon /> },
  { href: '/people', label: 'People & Teams', icon: <PeopleIcon /> },
  { href: '/settings', label: 'My Preferences', icon: <SettingsIcon /> },
  { href: '/moderation', label: 'Moderation', icon: <ShieldIcon /> },
  { href: '/analytics', label: 'Organizer Analytics', icon: <InsightsIcon /> },
];

const DRAWER_WIDTH = 264;

export function AppShell({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const pathname = usePathname();
  const { mode, toggleMode, user, logout } = useApp();

  const visibleNavItems = NAV_ITEMS.filter((item) => canAccess(item.href, user));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const navigation = (
    <Box sx={{ px: 2, py: 3 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1, mb: 3 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg,#0F766E,#2563EB)',
            color: '#fff',
            fontWeight: 800,
          }}
        >
          CS
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1}>
            Community Space
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Community intelligence
          </Typography>
        </Box>
      </Stack>

      <List sx={{ gap: 0.5, display: 'flex', flexDirection: 'column' }}>
        {visibleNavItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={active}
              onClick={() => setMobileOpen(false)}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }} primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>

      <Divider sx={{ my: 2 }} />
      <Box sx={{ px: 1 }}>
        <Chip size="small" color="secondary" variant="outlined" label="AI features active" sx={{ mb: 1 }} />
        <Typography variant="caption" color="text.secondary" display="block">
          Semantic search, RAG assistant and matching run on the configured AI provider with an offline fallback.
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: `1px solid ${theme.palette.divider}` },
          }}
        >
          {navigation}
        </Drawer>
      ) : (
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
          {navigation}
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar position="sticky" elevation={0}>
          <Toolbar sx={{ gap: 1 }}>
            {!isDesktop && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {NAV_ITEMS.find((item) => (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)))?.label ??
                'Community Space'}
            </Typography>

            <Tooltip title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              <IconButton onClick={toggleMode}>{mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}</IconButton>
            </Tooltip>

            {user ? (
              <>
                <Button onClick={(event) => setAnchorEl(event.currentTarget)} sx={{ gap: 1, borderRadius: 999 }}>
                  <Avatar src={user.avatarUrl ?? undefined} sx={{ width: 28, height: 28 }}>
                    {user.name[0]}
                  </Avatar>
                  <Box sx={{ textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
                    <Typography variant="body2" fontWeight={700} lineHeight={1.1}>
                      {user.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.role}
                    </Typography>
                  </Box>
                </Button>
                <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                  <MenuItem component={Link} href="/people" onClick={() => setAnchorEl(null)}>
                    My network
                  </MenuItem>
                  <MenuItem component={Link} href="/settings" onClick={() => setAnchorEl(null)}>
                    My preferences
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      logout();
                      setAnchorEl(null);
                    }}
                  >
                    Sign out
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button variant="contained" onClick={() => setAuthOpen(true)}>
                Sign in
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: 4 }}>
          {children}
        </Container>
      </Box>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </Box>
  );
}
