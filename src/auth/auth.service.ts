import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import jwtConfig from 'src/config/jwt.config';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { HashingService } from './hashing.service';
import { ActiveUserData } from './interfaces/active-user-data.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly hashingService: HashingService,
  ) {}

  async generateTokens(user: User) {
    const token = await this.signToken<Partial<ActiveUserData>>(user.id, {
      username: user.username,
    });
    return { token };
  }

  private async signToken<T>(userId: number, payload?: T) {
    return await this.jwtService.signAsync(
      {
        sub: userId,
        ...payload,
      },
      {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
        expiresIn: this.jwtConfiguration.accessTokenTtl,
      },
    );
  }

  async signUp(signUpDto: SignUpDto) {
    const { username, password } = signUpDto;

    const existingUser = await this.userRepository.findOne({
      where: [{ username }],
    });
    if (existingUser) throw new UnauthorizedException('User already exists');

    const hashedPassword = await this.hashingService.hash(password); // +
    const user = this.userRepository.create({
      ...signUpDto,
      password: hashedPassword,
    }); // +
    return this.userRepository.save(user);
  }

  async signIn(signInDto: SignInDto) {
    const { username, password } = signInDto;

    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) throw new UnauthorizedException('User not found');

    const isEqual = await this.hashingService.compare(password, user.password);
    if (!isEqual) throw new UnauthorizedException('Password is incorrect');

    return await this.generateTokens(user);
  }
}
