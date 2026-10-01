import { NotFoundError } from '../../core/errors';
import { VectorMath, toMatchPercentage } from '../../core/vector-math';
import type { Profile } from '../../domain/entities/models';
import type { IProfileRepository, IProjectRepository } from '../../domain/repositories';
import type { IEmbeddingProvider } from '../../domain/services/ai-provider';

export interface MatchCandidate {
  profile: Profile;
  score: number;
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
}

export interface MatchRequest {
  requiredSkills?: string[];
  description?: string;
  excludeUserIds?: string[];
  availability?: string;
  limit?: number;
}

/**
 * Collaborator / teammate matching.
 *
 * The final score blends three explainable signals so the UI can always answer
 * "why was this person suggested?":
 *   55% semantic similarity between the request and the member's profile
 *   35% exact skill coverage of the required skills
 *   10% availability + experience bonus
 */
export class MatchmakingService {
  private static readonly W_SEMANTIC = 0.55;
  private static readonly W_SKILLS = 0.35;
  private static readonly W_CONTEXT = 0.1;

  constructor(
    private readonly profiles: IProfileRepository,
    private readonly projects: IProjectRepository,
    private readonly ai: IEmbeddingProvider,
  ) {}

  async matchForProject(projectId: string, limit = 8): Promise<{ project: unknown; candidates: MatchCandidate[] }> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Project');

    const candidates = await this.match({
      requiredSkills: project.neededSkills,
      description: `${project.title}. ${project.description}`,
      excludeUserIds: [project.ownerId],
      limit,
    });

    return { project, candidates };
  }

  async match(request: MatchRequest): Promise<MatchCandidate[]> {
    const limit = request.limit ?? 8;
    const required = (request.requiredSkills ?? []).map((skill) => skill.trim()).filter(Boolean);
    const queryText = [request.description ?? '', required.length ? `Required skills: ${required.join(', ')}` : '']
      .filter(Boolean)
      .join('. ');

    const all = await this.profiles.listAll();
    const pool = all.filter((profile) => !request.excludeUserIds?.includes(profile.userId));
    if (pool.length === 0) return [];

    const profileTexts = pool.map((profile) => this.profileText(profile));
    const { vectors } = await this.ai.embed([queryText || 'community collaborator', ...profileTexts]);
    const queryVector = vectors[0] ?? [];

    const requiredLower = required.map((skill) => skill.toLowerCase());

    const candidates = pool.map((profile, index) => {
      const semantic = Math.max(0, VectorMath.cosineSimilarity(queryVector, vectors[index + 1] ?? []));

      const owned = [...profile.skills, ...profile.expertise];
      const ownedLower = owned.map((skill) => skill.toLowerCase());
      const matchedSkills = required.filter((skill) =>
        ownedLower.some((item) => item === skill.toLowerCase() || item.includes(skill.toLowerCase())),
      );
      const missingSkills = required.filter((skill) => !matchedSkills.includes(skill));
      const skillCoverage = requiredLower.length === 0 ? semantic : matchedSkills.length / requiredLower.length;

      const availabilityBonus =
        profile.availability === 'LOOKING_FOR_TEAM' ? 1 : profile.availability === 'OPEN' ? 0.7 : 0.2;
      const experienceBonus = Math.min(1, profile.experienceYrs / 8);
      const context = availabilityBonus * 0.6 + experienceBonus * 0.4;

      const score =
        MatchmakingService.W_SEMANTIC * semantic +
        MatchmakingService.W_SKILLS * skillCoverage +
        MatchmakingService.W_CONTEXT * context;

      const reasons: string[] = [];
      if (matchedSkills.length > 0) reasons.push(`Covers ${matchedSkills.join(', ')}`);
      if (semantic > 0.3) reasons.push('Profile is semantically close to the project brief');
      if (profile.availability === 'LOOKING_FOR_TEAM') reasons.push('Actively looking for a team');
      if (profile.experienceYrs >= 3) reasons.push(`${profile.experienceYrs} years of experience`);
      if (missingSkills.length > 0) reasons.push(`Gap: ${missingSkills.join(', ')}`);

      return {
        profile,
        score,
        matchPercentage: Math.round(Math.max(0, Math.min(1, score)) * 100),
        matchedSkills,
        missingSkills,
        reasons,
      } satisfies MatchCandidate;
    });

    return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** "Find people like me" - complementary collaborators for a member. */
  async matchForUser(userId: string, limit = 8): Promise<MatchCandidate[]> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) throw new NotFoundError('Profile');

    return this.match({
      description: this.profileText(profile),
      requiredSkills: profile.interests,
      excludeUserIds: [userId],
      limit,
    });
  }

  private profileText(profile: Profile): string {
    return [
      profile.name,
      profile.headline,
      profile.bio,
      `Skills: ${profile.skills.join(', ')}`,
      `Expertise: ${profile.expertise.join(', ')}`,
      `Interests: ${profile.interests.join(', ')}`,
      `Availability: ${profile.availability}`,
    ]
      .filter(Boolean)
      .join('. ');
  }
}

export const matchPercentageOf = toMatchPercentage;
