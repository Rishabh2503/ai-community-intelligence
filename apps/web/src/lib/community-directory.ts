export const directoryReviewedAt = '2026-09-21';

export const communityDirectory = [
  {
    name: 'GDG New Delhi', location: 'New Delhi, India', category: 'Developer community',
    description: 'Code labs, developer talks, DevFests and open-source learning in Delhi.',
    url: 'https://www.commudle.com/communities/gdg-new-delhi',
    image: 'https://json.commudle.com/rails/active_storage/blobs/proxy/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBMFc4QVE9PSIsImV4cCI6bnVsbCwicHVyIjoiYmxvYl9pZCJ9fQ==--57ae6113fa8d6d132f5d4c0ffb7b134836e8fecf/Untitled%20design.png',
    topics: ['Google technologies', 'Open source'], initials: 'GDG', color: '#1976D2',
  },
  {
    name: 'KNOTiC', location: 'New Delhi, India', category: 'Builders & hackathons',
    description: 'A developer network running workshops, hackathons and community meetups.',
    url: 'https://www.commudle.com/communities/knotic',
    image: 'https://json.commudle.com/rails/active_storage/blobs/proxy/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBM0ViQ0E9PSIsImV4cCI6bnVsbCwicHVyIjoiYmxvYl9pZCJ9fQ==--28b2ae2db9180bb9e2c390d915e06441b549bbdc/com_64bc2d18b0f0752b_20260919174558.png',
    topics: ['AI', 'Cloud', 'Hackathons'], initials: 'K', color: '#C43C58',
  },
  {
    name: 'Indian AI Community', location: 'New Delhi, India', category: 'Artificial intelligence',
    description: 'Engineers, designers and founders exploring practical AI through shared projects and meetups.',
    url: 'https://www.commudle.com/communities/indian-ai-community', image: '',
    topics: ['AI', 'Meetups'], initials: 'AI', color: '#087E6E',
  },
  {
    name: 'Software Development Cell, GGSIPU', location: 'New Delhi, India', category: 'Campus community',
    description: 'A student-run developer community at Guru Gobind Singh Indraprastha University.',
    url: 'https://www.commudle.com/communities/software-development-cell-sdc-ggsipu', image: '',
    topics: ['Students', 'Workshops'], initials: 'SDC', color: '#9A6400',
  },
];

export function directoryMatches(location: string, region: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/new delhi/g, 'delhi').replace(/bangalore/g, 'bengaluru');
  return normalize(region).split(',').map((part) => part.trim()).filter(Boolean).every((part) => normalize(location).includes(part));
}