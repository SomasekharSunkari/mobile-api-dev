import { Body, Controller, Get, Headers, HttpStatus, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { Throttle } from '@nestjs/throttler';
import { BaseController } from '../../../base';
import { ThrottleGroups } from '../../../constants/constants';
import { HttpContext } from '../../../decorators/http/HttpContext';
import { HttpContextManagement } from '../../../decorators/http/http_context.interface';
import { AuthPayload } from '../auth.interface';
import { JwtAuthGuard } from '../strategies/jwt-auth.guard';
import { RegisterDto } from './dto';
import { CheckUsernameExistDto } from './dto/checkUsernameExist.dto';
import { RegisterCheckDto } from './dto/registerCheck.dto';
import { RegisterResponseDto } from './dto/registerResponse.dto';
import { AccountVerificationDto } from './dto/sendVerificationCode.dto';
import { AccountVerificationResponseDto } from './dto/sendVerificationCodeResponse.dto';
import { RegisterService } from './register.service';

@ApiTags('Auth')
@Controller('auth')
export class RegisterController extends BaseController {
  @Inject(RegisterService)
  private readonly registerService: RegisterService;

  @Post('register')
  @Throttle({ default: ThrottleGroups.DEFAULT })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiHeader({ name: 'X-Forwarded-For', description: 'Client IP address', required: true })
  @ApiHeader({ name: 'X-Fingerprint', description: 'Device fingerprint', required: true })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
  ): Promise<any> {
    // Extract security headers following production patterns
    const ipAddress = headers['x-forwarded-for'] || headers['x-real-ip'] || req.ip || req.socket.remoteAddress;
    const fingerprint = headers['x-fingerprint'];

    const tokenResult: AuthPayload = await this.registerService.register(registerDto, {
      clientIp: ipAddress,
      fingerprint,
    });

    return this.transformResponse('User registered successfully', tokenResult, HttpStatus.CREATED);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access_token')
  @Get()
  @ApiOperation({ summary: 'Get current user context (for debugging/auth verification)' })
  @ApiResponse({
    status: 200,
    description: 'User fetched successfully',
  })
  async findAll(@HttpContext() httpContext: HttpContextManagement) {
    const context = httpContext;
    return this.transformResponse('User fetched successfully', context);
  }

  @Post('register/check')
  @Throttle({ default: ThrottleGroups.DEFAULT })
  @ApiOperation({ summary: 'Checks for the existence of a username' })
  @ApiResponse({
    status: 201,
    description: 'Registration data successfully checked',
    type: RegisterResponseDto,
  })
  async checkRegistration(@Body() data: RegisterCheckDto): Promise<any> {
    const response = await this.registerService.checkRegister(data);

    return this.transformResponse('Registration data successfully checked', response, HttpStatus.CREATED);
  }

  @Post('register/check/username')
  @Throttle({ default: ThrottleGroups.DEFAULT })
  @ApiOperation({ summary: 'Checks for the existence of a username' })
  @ApiResponse({
    status: 201,
    description: 'Username successfully checked',
    type: RegisterResponseDto,
  })
  async checkUsernameExists(@Body() data: CheckUsernameExistDto): Promise<any> {
    const response = await this.registerService.checkUsernameExists(data.username);

    return this.transformResponse('Username successfully checked', response, HttpStatus.CREATED);
  }

  @Post('register/send')
  @ApiOperation({ summary: 'Send verification code via email' })
  @ApiBody({ type: AccountVerificationDto })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent',
    type: AccountVerificationResponseDto,
  })
  @Throttle({ default: ThrottleGroups.STRICT })
  async resendVerificationCode(@Body() data: AccountVerificationDto) {
    const response = await this.registerService.sendVerificationCode(data);

    return this.transformResponse('Verification Code Sent Successfully', response);
  }
}
