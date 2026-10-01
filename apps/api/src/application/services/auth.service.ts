import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../core/errors';
import type { Profile, UserRole, UserSummary } from '../../domain/entities/models';
import type { IProfileRepository, IUserRepository, ListQuery, ProfileInput } from '../../domain/repositories';
import type { IPasswordHasher, ITokenService } from '../../infrastructure/security/security';
import type { IndexingService } from './indexing.service';

export interface AuthResult {
  token: string;
  user: UserSummary;
}

/** Registration, login and identity lookup. Nothing else. */
export class AuthService {
  constructor(
    private readonly users: IUserRepository,
    private readonly profiles: IProfileRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ITokenService,
    private readonly indexing: IndexingService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
    profile?: ProfileInput;
  }): Promise<AuthResult> {
    if (input.password.length < 6) throw new BadRequestError('Password must be at least 6 characters');

    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictError('An account with this email already exists');

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role ?? 'MEMBER',
    });

    await this.profiles.upsert(user.id, input.profile ?? {});
    await this.indexing.indexEntity('PROFILE', user.id);

    return { token: this.tokens.sign({ sub: user.id, email: user.email, role: user.role }), user: this.toSummary(user) };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const valid = await this.hasher.verify(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    return { token: this.tokens.sign({ sub: user.id, email: user.email, role: user.role }), user: this.toSummary(user) };
  }

  async me(userId: string): Promise<UserSummary & { profile: Profile | null }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User');
    const profile = await this.profiles.findByUserId(userId);
    return { ...this.toSummary(user), profile };
  }

  private toSummary(user: { id: string; name: string; email: string; role: UserRole; avatarUrl: string | null }): UserSummary {
    return { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl };
  }
}

/** Searchable member directory. */
export class ProfileService {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly indexing: IndexingService,
  ) {}

  async get(userId: string): Promise<Profile> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) throw new NotFoundError('Profile');
    return profile;
  }

  async list(query: ListQuery & { skills?: string[]; availability?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const { items, total } = await this.profiles.findMany({ ...query, page, pageSize });
    return { items, total, page, pageSize };
  }

  async upsert(userId: string, data: ProfileInput): Promise<Profile> {
    const profile = await this.profiles.upsert(userId, data);
    await this.indexing.indexEntity('PROFILE', userId);
    return profile;
  }
}
