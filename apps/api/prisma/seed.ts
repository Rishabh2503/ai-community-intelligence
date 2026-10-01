/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createContainer } from '../src/container';
import { stringify } from '../src/core/json';

/**
 * Seeds a realistic community dataset and builds the semantic index.
 * Every demo account uses the password `password123`.
 */
const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';

const daysFromNow = (days: number, hour = 18): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const people = [
  {
    email: 'aarav@communityspace.dev',
    name: 'Aarav Sharma',
    role: 'ORGANIZER',
    headline: 'Full-stack engineer & GDG organizer',
    bio: 'I run developer meetups, mentor students on open source and build web platforms with React, Node.js and PostgreSQL. I love turning messy community WhatsApp groups into structured knowledge.',
    location: 'Bengaluru, India',
    availability: 'HIRING',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker'],
    interests: ['Open Source', 'Developer Communities', 'Mentoring'],
    expertise: ['Web Architecture', 'Community Building'],
    experienceYrs: 7,
  },
  {
    email: 'meera@communityspace.dev',
    name: 'Meera Nair',
    role: 'ORGANIZER',
    headline: 'ML engineer working on NLP and RAG systems',
    bio: 'Natural language processing engineer. I build retrieval augmented generation pipelines, vector search and evaluation harnesses. Currently exploring small language models that run on laptops.',
    location: 'Kochi, India',
    availability: 'OPEN',
    skills: ['Python', 'PyTorch', 'Transformers', 'Vector Databases', 'LangChain'],
    interests: ['NLP', 'RAG', 'AI Safety'],
    expertise: ['Machine Learning', 'Semantic Search'],
    experienceYrs: 5,
  },
  {
    email: 'rohan@communityspace.dev',
    name: 'Rohan Gupta',
    role: 'MEMBER',
    headline: 'Final year CS student looking for a hackathon team',
    bio: 'Second-time hackathon participant. Comfortable with React Native and Firebase, currently learning system design. Looking for a team for the upcoming 36 hour hackathon.',
    location: 'Pune, India',
    availability: 'LOOKING_FOR_TEAM',
    skills: ['React Native', 'Firebase', 'JavaScript', 'Figma'],
    interests: ['Hackathons', 'Mobile Apps', 'UI Design'],
    expertise: ['Mobile Development'],
    experienceYrs: 1,
  },
  {
    email: 'ananya@communityspace.dev',
    name: 'Ananya Iyer',
    role: 'MEMBER',
    headline: 'Cloud & DevOps engineer, Kubernetes enthusiast',
    bio: 'I automate everything. Terraform, Kubernetes, GitHub Actions and observability with Grafana. I speak at cloud meetups about cost optimisation and platform engineering.',
    location: 'Hyderabad, India',
    availability: 'OPEN',
    skills: ['Kubernetes', 'Terraform', 'AWS', 'CI/CD', 'Grafana'],
    interests: ['Platform Engineering', 'Observability', 'Public Speaking'],
    expertise: ['DevOps', 'Cloud Infrastructure'],
    experienceYrs: 6,
  },
  {
    email: 'vikram@communityspace.dev',
    name: 'Vikram Desai',
    role: 'MEMBER',
    headline: 'Product designer turned frontend developer',
    bio: 'Design systems, accessibility and motion design. I build component libraries in React with Material UI and care deeply about inclusive interfaces.',
    location: 'Mumbai, India',
    availability: 'LOOKING_FOR_TEAM',
    skills: ['Figma', 'React', 'Material UI', 'Accessibility', 'CSS'],
    interests: ['Design Systems', 'Accessibility', 'Hackathons'],
    expertise: ['Product Design', 'Frontend'],
    experienceYrs: 4,
  },
  {
    email: 'sara@communityspace.dev',
    name: 'Sara Khan',
    role: 'ADMIN',
    headline: 'Community manager & data analyst',
    bio: 'I measure what communities actually need. Dashboards, surveys, retention analysis and moderation policy. Previously ran a 12,000 member student developer network.',
    location: 'Delhi, India',
    availability: 'BUSY',
    skills: ['SQL', 'Data Analysis', 'Community Strategy', 'Moderation'],
    interests: ['Analytics', 'Governance', 'Inclusion'],
    expertise: ['Community Operations', 'Analytics'],
    experienceYrs: 8,
  },
];

const communities = [
  {
    name: 'Bengaluru JavaScript Collective',
    description:
      'A gathering of JavaScript and TypeScript practitioners in Bengaluru. Monthly meetups covering React, Node.js, build tooling and performance, plus hands-on code labs for newcomers.',
    category: 'Software Engineering',
    tags: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
    location: 'Bengaluru, India',
  },
  {
    name: 'Applied AI & NLP Circle',
    description:
      'For people building with language models: retrieval augmented generation, embeddings, evaluation, fine-tuning and responsible deployment. Paper reading every alternate Saturday.',
    category: 'Artificial Intelligence',
    tags: ['Machine Learning', 'NLP', 'RAG', 'LLM'],
    location: 'Online',
  },
  {
    name: 'Cloud Native India',
    description:
      'Kubernetes, Terraform, observability and platform engineering. We run hands-on workshops, certification study groups and a job board for infrastructure roles.',
    category: 'Cloud & DevOps',
    tags: ['Kubernetes', 'DevOps', 'AWS', 'Terraform'],
    location: 'Hyderabad, India',
  },
  {
    name: 'Campus Hackathon Network',
    description:
      'Student-run network connecting college hackathon organizers and participants across India. Team formation, mentor matching, sponsor templates and post-event knowledge sharing.',
    category: 'Student Community',
    tags: ['Hackathons', 'Students', 'Mentorship', 'Teams'],
    location: 'Pan India',
  },
  {
    name: 'Design Systems Guild',
    description:
      'Designers and frontend engineers maintaining component libraries. Accessibility audits, token architecture, documentation practices and design-to-code workflows.',
    category: 'Design',
    tags: ['Design Systems', 'Accessibility', 'Figma', 'Frontend'],
    location: 'Online',
  },
];

const seedEvents = (communityIds: string[], organizerIds: string[]) => [
  {
    communityIndex: 0,
    organizerIndex: 0,
    title: 'React Performance Deep Dive: Profiling Real Applications',
    description:
      'A three hour hands-on session where we profile a deliberately slow React application and fix it together. We will cover the React Profiler, why re-renders happen, memoisation trade-offs, list virtualisation for large tables, code splitting with lazy boundaries, and how to measure Core Web Vitals in production. Bring a laptop with Node 20 installed. The second half is an open lab where you can profile your own application with help from the mentors. Participants will leave with a checklist they can apply to any React codebase and a small repository containing every example from the session.',
    mode: 'OFFLINE',
    venue: 'Indiranagar Tech Hub, Bengaluru',
    startsAt: daysFromNow(6, 10),
    endsAt: daysFromNow(6, 13),
    capacity: 60,
    tags: ['React', 'Performance', 'Workshop'],
  },
  {
    communityIndex: 1,
    organizerIndex: 1,
    title: 'Build a RAG Assistant Over Your Own Documents',
    description:
      'Retrieval augmented generation explained from first principles and then built live. We start with why plain language models hallucinate about private data, move to chunking strategies and why chunk size matters, compare embedding models including all-MiniLM-L6-v2 and larger alternatives, and store vectors in a simple database. We then wire retrieval into a prompt, add citations so answers can be verified, and finish with evaluation: how do you know your assistant got better? Prior Python experience helps but the concepts apply to any stack.',
    mode: 'ONLINE',
    venue: 'Online (Zoom)',
    startsAt: daysFromNow(11, 19),
    endsAt: daysFromNow(11, 21),
    capacity: 300,
    tags: ['RAG', 'LLM', 'Embeddings', 'Tutorial'],
  },
  {
    communityIndex: 2,
    organizerIndex: 3,
    title: 'Kubernetes Cost Optimisation Clinic',
    description:
      'Most teams overspend on Kubernetes by 40 percent or more. In this clinic we examine right-sizing requests and limits, horizontal and vertical autoscaling, spot instance strategies, bin packing, and how to attribute cost per team using labels. We will review three anonymised real cluster bills and identify savings live. Bring your own cluster metrics if you want a second opinion during the open clinic segment.',
    mode: 'HYBRID',
    venue: 'HITEC City, Hyderabad + Online',
    startsAt: daysFromNow(18, 15),
    endsAt: daysFromNow(18, 18),
    capacity: 120,
    tags: ['Kubernetes', 'FinOps', 'Cloud'],
  },
  {
    communityIndex: 3,
    organizerIndex: 0,
    title: 'Winter Campus Hackathon 2026: Team Formation Mixer',
    description:
      'Before the 36 hour Winter Campus Hackathon we run a structured team formation mixer. Participants introduce themselves in 60 seconds, then rotate through skill tables: frontend, backend, machine learning, design and product. Mentors help balance teams so no team ends up with five backend developers and no designer. We also explain the judging rubric, the API credits available from sponsors, and the submission process. Attending this mixer roughly doubles the chance of submitting a finished project.',
    mode: 'OFFLINE',
    venue: 'COEP Auditorium, Pune',
    startsAt: daysFromNow(9, 16),
    endsAt: daysFromNow(9, 19),
    capacity: 200,
    tags: ['Hackathon', 'Teams', 'Students', 'Networking'],
  },
  {
    communityIndex: 4,
    organizerIndex: 4,
    title: 'Accessibility Audit Lab: Fixing Real Component Libraries',
    description:
      'An applied accessibility session for frontend developers and designers. We audit three open source component libraries against WCAG 2.2 AA using axe, keyboard-only navigation and screen readers. Topics include focus management in dialogs, accessible names for icon buttons, colour contrast in dark themes, reduced motion preferences and announcing asynchronous updates with live regions. Every finding is turned into a pull request during the lab.',
    mode: 'ONLINE',
    venue: 'Online (Meet)',
    startsAt: daysFromNow(24, 18),
    endsAt: daysFromNow(24, 20),
    capacity: 150,
    tags: ['Accessibility', 'Design Systems', 'Frontend'],
  },
  {
    communityIndex: 1,
    organizerIndex: 1,
    title: 'Paper Reading: Embedding Models Compared',
    description:
      'We read and discuss three papers on sentence embeddings, comparing training objectives, benchmark performance on MTEB and practical latency considerations for self-hosted deployment. Newcomers are welcome; we summarise each paper before discussing it so you can participate without having read everything in advance.',
    mode: 'ONLINE',
    venue: 'Online (Discord)',
    startsAt: daysFromNow(3, 20),
    endsAt: daysFromNow(3, 21),
    capacity: 80,
    tags: ['Research', 'Embeddings', 'NLP'],
  },
];

const seedResources = [
  {
    communityIndex: 1,
    authorIndex: 1,
    title: 'Chunking Strategies for Retrieval: A Practical Guide',
    description:
      'A written guide comparing fixed-size chunking, sentence-aware chunking and semantic chunking. It explains why overlapping windows reduce boundary loss, how chunk size interacts with the context window of your model, and includes measured recall numbers for each strategy on a documentation corpus. Also covers metadata enrichment so that retrieved chunks remain understandable out of context.',
    url: 'https://example.com/chunking-guide',
    type: 'ARTICLE',
    tags: ['RAG', 'Embeddings', 'Retrieval'],
  },
  {
    communityIndex: 0,
    authorIndex: 0,
    title: 'Node.js Layered Architecture Starter Template',
    description:
      'An opinionated Express and TypeScript starter that demonstrates layered architecture: domain interfaces, repositories, services and controllers with a composition root for dependency injection. Includes Prisma, Zod validation, centralised error handling and an example test suite.',
    url: 'https://example.com/node-layered-template',
    type: 'REPO',
    tags: ['Node.js', 'TypeScript', 'Architecture', 'SOLID'],
  },
  {
    communityIndex: 2,
    authorIndex: 3,
    title: 'Terraform Modules for a Production Ready EKS Cluster',
    description:
      'Reusable Terraform modules that provision a hardened EKS cluster with IRSA, managed node groups, cluster autoscaler, external DNS and a Grafana stack. Documented variables, sensible defaults and a teardown script so you can experiment without leaving expensive resources running.',
    url: 'https://example.com/eks-modules',
    type: 'REPO',
    tags: ['Terraform', 'Kubernetes', 'AWS'],
  },
  {
    communityIndex: 3,
    authorIndex: 2,
    title: 'Hackathon Survival Kit: 36 Hours Without Burning Out',
    description:
      'Checklist built from five hackathons. Covers scoping a demo you can actually finish, splitting work so people are not blocked, what to prepare before the clock starts, a pitch structure that fits in three minutes, and the mistakes that cost teams the most points during judging.',
    url: 'https://example.com/hackathon-kit',
    type: 'DOC',
    tags: ['Hackathons', 'Teamwork', 'Students'],
  },
  {
    communityIndex: 4,
    authorIndex: 4,
    title: 'Design Tokens to Material UI Theme: A Migration Walkthrough',
    description:
      'Step by step walkthrough converting a Figma token set into a Material UI theme, including palette, typography scale, spacing, shape and component overrides. Explains how to keep light and dark modes in sync and how to expose tokens as CSS variables for non-React surfaces.',
    url: 'https://example.com/tokens-to-mui',
    type: 'ARTICLE',
    tags: ['Design Systems', 'Material UI', 'Theming'],
  },
  {
    communityIndex: 0,
    authorIndex: 3,
    title: 'Docker Compose Recipes for Local Development',
    description:
      'A collection of compose files for common local stacks: Postgres with pgAdmin, Redis, MinIO, Mailhog and a reverse proxy. Includes health checks, named volumes and a make target that resets the whole environment in one command.',
    url: 'https://example.com/compose-recipes',
    type: 'TOOL',
    tags: ['Docker', 'DevOps', 'Productivity'],
  },
];

const seedAnnouncements = [
  {
    communityIndex: 3,
    authorIndex: 0,
    title: 'Winter Campus Hackathon 2026: registrations, rules and sponsor credits',
    priority: 'HIGH',
    body: `Registrations for the Winter Campus Hackathon 2026 are now open and will close at 23:59 on the last day of the month or once we reach 400 participants, whichever happens first. The hackathon runs for 36 continuous hours starting Friday evening at the COEP campus in Pune, with overnight access to the lab, meals, and a quiet room for resting.

Teams must have between two and four members. If you do not have a team you should attend the team formation mixer, where mentors help balance skills across frontend, backend, machine learning and design. Solo participants who skip the mixer historically have the lowest submission rate, so we strongly encourage attendance.

The theme will be announced at the opening ceremony, but all three tracks (developer tooling, civic technology and accessibility) will be available regardless of theme. Judging weights working demo at 40 percent, technical depth at 25 percent, design and usability at 20 percent and presentation at 15 percent. Projects must be started at the event; bringing a pre-built codebase leads to disqualification, although using open source libraries and public templates is fine and expected.

Every registered team receives sponsor credits: 50 dollars of cloud credit, free API access to two AI providers for the duration of the event, and a shared pool of design assets. To claim credits, one team member must submit the team code through the participant portal before the opening ceremony ends.

Mentors will be available in four-hour shifts throughout the event. The mentor schedule and their areas of expertise will be published in the resources section a week before the event so you can plan when to ask for help. Please read the code of conduct before arriving; it is enforced strictly and covers behaviour in the venue, on the Discord server and in project submissions.`,
  },
  {
    communityIndex: 1,
    authorIndex: 1,
    title: 'New paper reading format and a call for volunteer presenters',
    priority: 'NORMAL',
    body: `Starting next month the paper reading sessions move to a new format based on feedback from the last survey. Instead of one person presenting an entire paper for fifty minutes, we will split each session into three parts: a ten minute context talk explaining why the paper matters, a twenty minute walkthrough of the method, and a twenty minute open discussion where we try to poke holes in the evaluation.

We are looking for volunteer presenters. You do not need to be an expert. In fact, presenting a paper you are still learning tends to produce better discussion because you ask the questions everyone else is embarrassed to ask. We will pair every first-time presenter with an experienced member who reviews the slides beforehand.

We are also adding a written summary requirement. After each session the presenter posts a short summary in the resources section so that members who could not attend still benefit. These summaries have become the most searched content in this community, which is why we are formalising them.

If you want to present, reply with the paper title and the date you prefer. Slots for the next quarter will be allocated within a week.`,
  },
  {
    communityIndex: 2,
    authorIndex: 3,
    title: 'Certification study group: CKA cohort starting in two weeks',
    priority: 'NORMAL',
    body: `A new Certified Kubernetes Administrator study cohort begins in two weeks and will run for eight weeks. We meet twice a week for ninety minutes: one session on theory and one hands-on lab session where we break a cluster and fix it under exam-like time pressure.

The cohort is capped at twenty five people so that everyone gets attention during labs. Priority goes to members who have attended at least one previous workshop, but if there is space we will open registration to everyone. There is no fee; the only expectation is that you complete the weekly lab before the next session, which takes about two hours.

You will need your own cluster for practice. Any of kind, minikube, k3s or a small managed cluster works. We publish a setup guide before the first session with exact versions so everyone is working with the same environment. If cloud cost is a barrier, tell us privately and we will arrange shared credits from the community pool.`,
  },
];

const seedPosts = [
  {
    communityIndex: 0,
    authorIndex: 2,
    title: 'How do you structure a monorepo with a Next.js frontend and an Express API?',
    body: `I am building a project with a Next.js frontend and an Express API and I keep going back and forth on the folder structure. Right now I have apps/web and apps/api with npm workspaces, and I share types by importing directly across the boundary, which feels wrong. Should shared types live in a third package? How do you handle running both in development without two terminals? And does anyone have a pattern for keeping API client code in sync with the backend routes without generating an OpenAPI spec?`,
    tags: ['Monorepo', 'Next.js', 'Architecture'],
  },
  {
    communityIndex: 1,
    authorIndex: 4,
    title: 'Semantic search returns relevant results but users still complain. What am I missing?',
    body: `Our vector search returns results that I consider relevant, but users keep saying they cannot find things. Looking at the logs, most queries are short: two or three words, often an exact product name or an acronym. My suspicion is that pure embedding similarity dilutes exact matches. Has anyone combined lexical scoring with vector scoring, and what weighting worked for you? Also curious whether showing a match percentage helps or hurts user trust.`,
    tags: ['Search', 'Embeddings', 'UX'],
  },
  {
    communityIndex: 3,
    authorIndex: 2,
    title: 'Looking for a designer and a backend developer for the winter hackathon',
    body: `I am a final year CS student with React Native and Firebase experience. I want to build an app that helps college students find study groups using their timetable and subjects. I need someone who can design a clean interface and someone comfortable with backend and databases. I can commit the full 36 hours and I already have the idea validated with about forty students from my campus.`,
    tags: ['Hackathons', 'Team Formation', 'Mobile'],
  },
];

const seedProjects = [
  {
    ownerIndex: 2,
    title: 'StudySync: timetable-aware study group finder',
    description:
      'A mobile app that reads a student timetable and suggests study groups with overlapping free slots and shared subjects. Needs a designer for the onboarding flow and a backend developer for the matching service.',
    neededSkills: ['UI Design', 'Node.js', 'PostgreSQL', 'React Native'],
    teamSize: 4,
  },
  {
    ownerIndex: 1,
    title: 'OpenEval: an evaluation harness for community RAG assistants',
    description:
      'An open source tool that lets community organizers measure whether their knowledge assistant is actually answering correctly. Needs help with the frontend dashboard and with writing evaluation datasets.',
    neededSkills: ['React', 'Python', 'Evaluation', 'Technical Writing'],
    teamSize: 5,
  },
  {
    ownerIndex: 4,
    title: 'A11yKit: automated accessibility checks for component libraries',
    description:
      'A GitHub Action that runs accessibility audits on every pull request for design system repositories and comments with actionable findings. Looking for a DevOps contributor and someone who knows the axe rule set well.',
    neededSkills: ['Accessibility', 'CI/CD', 'TypeScript'],
    teamSize: 3,
  },
];

async function main(): Promise<void> {
  console.log('Clearing existing data...');
  await prisma.assistantQuery.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.embeddingRecord.deleteMany();
  await prisma.report.deleteMany();
  await prisma.rsvp.deleteMany();
  await prisma.project.deleteMany();
  await prisma.post.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.event.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.community.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creating users and profiles...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds: string[] = [];

  for (const person of people) {
    const user = await prisma.user.create({
      data: {
        email: person.email,
        name: person.name,
        role: person.role,
        passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(person.name)}`,
        profile: {
          create: {
            headline: person.headline,
            bio: person.bio,
            location: person.location,
            availability: person.availability,
            skills: stringify(person.skills),
            interests: stringify(person.interests),
            expertise: stringify(person.expertise),
            links: stringify({ github: `https://github.com/${person.name.split(' ')[0].toLowerCase()}` }),
            experienceYrs: person.experienceYrs,
          },
        },
      },
    });
    userIds.push(user.id);
  }

  console.log('Creating communities...');
  const communityIds: string[] = [];
  for (const [index, community] of communities.entries()) {
    const created = await prisma.community.create({
      data: {
        slug: community.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: community.name,
        description: community.description,
        category: community.category,
        tags: stringify(community.tags),
        location: community.location,
      },
    });
    communityIds.push(created.id);

    // Everyone joins a couple of communities so analytics has signal.
    for (const [userIndex, userId] of userIds.entries()) {
      if ((userIndex + index) % 2 === 0) {
        await prisma.membership.create({
          data: { userId, communityId: created.id, role: userIndex === index % userIds.length ? 'ORGANIZER' : 'MEMBER' },
        });
      }
    }
  }

  console.log('Creating events...');
  const eventIds: string[] = [];
  for (const event of seedEvents(communityIds, userIds)) {
    const created = await prisma.event.create({
      data: {
        communityId: communityIds[event.communityIndex],
        organizerId: userIds[event.organizerIndex],
        title: event.title,
        description: event.description,
        mode: event.mode,
        venue: event.venue,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        capacity: event.capacity,
        tags: stringify(event.tags),
      },
    });
    eventIds.push(created.id);
  }

  console.log('Creating resources, announcements, posts and projects...');
  for (const resource of seedResources) {
    await prisma.resource.create({
      data: {
        communityId: communityIds[resource.communityIndex],
        authorId: userIds[resource.authorIndex],
        title: resource.title,
        description: resource.description,
        url: resource.url,
        type: resource.type,
        tags: stringify(resource.tags),
      },
    });
  }

  for (const announcement of seedAnnouncements) {
    await prisma.announcement.create({
      data: {
        communityId: communityIds[announcement.communityIndex],
        authorId: userIds[announcement.authorIndex],
        title: announcement.title,
        body: announcement.body,
        priority: announcement.priority,
      },
    });
  }

  for (const post of seedPosts) {
    await prisma.post.create({
      data: {
        communityId: communityIds[post.communityIndex],
        authorId: userIds[post.authorIndex],
        title: post.title,
        body: post.body,
        tags: stringify(post.tags),
      },
    });
  }

  for (const project of seedProjects) {
    await prisma.project.create({
      data: {
        ownerId: userIds[project.ownerIndex],
        title: project.title,
        description: project.description,
        neededSkills: stringify(project.neededSkills),
        teamSize: project.teamSize,
      },
    });
  }

  console.log('Creating RSVPs and engagement signals...');
  for (const [index, eventId] of eventIds.entries()) {
    for (const [userIndex, userId] of userIds.entries()) {
      if ((userIndex + index) % 3 !== 0) continue;
      await prisma.rsvp.create({ data: { eventId, userId, status: 'GOING' } });
      await prisma.interaction.create({
        data: { userId, entityType: 'EVENT', entityId: eventId, action: 'RSVP', weight: 3 },
      });
    }
    await prisma.interaction.create({
      data: { userId: userIds[index % userIds.length], entityType: 'EVENT', entityId: eventId, action: 'VIEW' },
    });
  }

  const sampleQuestions = [
    'When is the next hackathon and how do I register?',
    'What are the rules for hackathon team size?',
    'Which resources explain RAG chunking?',
    'Who can help me with Kubernetes cost optimisation?',
    'How do I join the CKA study group?',
  ];
  for (const [index, question] of sampleQuestions.entries()) {
    await prisma.assistantQuery.create({
      data: {
        userId: userIds[index % userIds.length],
        question,
        answer: 'Seeded example answer.',
        sources: stringify([]),
        topicLabel: question.toLowerCase().includes('hackathon')
          ? 'hackathon registration'
          : question.toLowerCase().includes('rag')
            ? 'rag chunking'
            : 'community operations',
        latencyMs: 120 + index * 20,
        provider: 'seed',
      },
    });
  }

  console.log('Creating a moderation example...');
  const firstResource = await prisma.resource.findFirst();
  if (firstResource) {
    await prisma.report.create({
      data: {
        targetType: 'RESOURCE',
        targetId: firstResource.id,
        targetTitle: firstResource.title,
        reporterId: userIds[2],
        reason: 'DUPLICATE',
        details: 'This looks very similar to another guide that was posted in the same community last month.',
        aiVerdict: 'NEEDS_HUMAN_REVIEW',
        aiScore: 0.52,
        aiRationale: 'Moderate similarity to existing content; flagged for a human decision.',
      },
    });
  }

  await prisma.$disconnect();

  console.log('Building the semantic index (this uses the configured AI provider)...');
  const container = createContainer();
  const result = await container.services.indexing.reindexAll();
  console.log(`Indexed ${result.indexed} entities:`, result.byType);
  await container.prisma.$disconnect();

  console.log('\nSeed complete.');
  console.log('Demo accounts (password: password123)');
  for (const person of people) console.log(`  ${person.role.padEnd(9)} ${person.email}`);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
