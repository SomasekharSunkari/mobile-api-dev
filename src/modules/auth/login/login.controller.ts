import { Body, Controller, Headers, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { BaseController } from '../../../base';
import { ThrottleGroups } from '../../../constants/constants';
import { SecurityContext } from '../../../decorators/http/http_context.interface';
import { SecurityContext as SecurityContextDecorator } from '../../../decorators/security-context.decorator';
import { LoginResponse } from '../auth.interface';
import { LoginSecurityService } from '../loginSecurity/loginSecurity.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/loginResponse.dto';
import { VerifyOtpDto } from './dto/verifyOtp.dto';
import { LoginRiskScore } from './login.interface';
import { LoginService } from './login.service';

@ApiTags('Auth')
@Controller('auth')
export class LoginController extends BaseController {
  @Inject(LoginService)
  private readonly loginService: LoginService;

  @Inject(LoginSecurityService)
  private readonly loginSecurityService: LoginSecurityService;

  @Post('login')
  @ApiOperation({ summary: 'Login with email, username, or phone and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiHeader({ name: 'X-Device-Name', description: 'Device name', required: false })
  @ApiHeader({ name: 'X-Device-Type', description: 'Device type', required: false })
  @ApiHeader({ name: 'X-OS', description: 'Operating system', required: false })
  @ApiHeader({ name: 'X-Browser', description: 'Browser name', required: false })
  async login(@Body() loginDto: LoginDto, @SecurityContextDecorator() securityContext: SecurityContext) {
    this.logger.log({ securityContext });
    const result: LoginResponse = await this.loginService.login(loginDto, securityContext);
    return this.transformResponse(result.message, result, HttpStatus.CREATED);
  }

  @Post('login-biometric')
  @ApiOperation({ summary: 'Login with fingerprint, faceID' })
  @ApiResponse({
    status: 200,
    description: 'Returns a JWT token and expiration',
    schema: {
      example: {
        message: 'Login successful',
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR...',
          expiration: '2025-04-16T10:00:00.000Z',
        },
        statusCode: 200,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiHeader({ name: 'x-refresh-token', description: 'Refresh token for biometric login' })
  @ApiHeader({ name: 'X-Device-Name', description: 'Device name', required: false })
  @ApiHeader({ name: 'X-Device-Type', description: 'Device type', required: false })
  @ApiHeader({ name: 'X-OS', description: 'Operating system', required: false })
  @ApiHeader({ name: 'X-Browser', description: 'Browser name', required: false })
  async loginWithBiometrics(
    @Headers('x-refresh-token') refreshToken: string,
    @SecurityContextDecorator() securityContext: SecurityContext,
  ): Promise<any> {
    const result: LoginResponse = await this.loginService.loginWithBiometrics(refreshToken, securityContext);
    return this.transformResponse(result.message, result, HttpStatus.CREATED);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP for high-risk login' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 201,
    description: 'OTP verified successfully, login completed',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  @ApiHeader({ name: 'X-Fingerprint', description: 'Device fingerprint', required: true })
  @ApiHeader({ name: 'X-Device-Name', description: 'Device name', required: false })
  @ApiHeader({ name: 'X-Device-Type', description: 'Device type', required: false })
  @ApiHeader({ name: 'X-OS', description: 'Operating system', required: false })
  @ApiHeader({ name: 'X-Browser', description: 'Browser name', required: false })
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @SecurityContextDecorator() securityContext: SecurityContext,
  ): Promise<any> {
    // Verify OTP and get user details
    const { user } = await this.loginSecurityService.verifyLoginOtp(verifyOtpDto.code, securityContext);

    try {
      // Complete successful login with risk score of 30+ since this was a high-risk login that required OTP
      const result = await this.loginService.successfulLogin(user, securityContext, {
        score: LoginRiskScore.HIGH,
        reasons: ['high_risk_otp_verified'],
      });

      return this.transformResponse('Login successful', result, HttpStatus.CREATED);
    } catch (error) {
      this.logger.error(`Failed to complete login for user ${user.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('resend-otp')
  @Throttle({ default: ThrottleGroups.STRICT })
  @ApiOperation({ summary: 'Resend OTP for high-risk login' })
  @ApiResponse({
    status: 200,
    description: 'OTP resent successfully',
    schema: {
      example: {
        message: 'Verification code resent',
        data: {
          otpMessage: 'Code sent to ******0123',
        },
        statusCode: 200,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No active OTP session or invalid email address' })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit: 2 requests per 10 seconds' })
  @ApiHeader({ name: 'X-Fingerprint', description: 'Device fingerprint', required: true })
  @ApiHeader({ name: 'X-Device-Name', description: 'Device name', required: false })
  @ApiHeader({ name: 'X-Device-Type', description: 'Device type', required: false })
  @ApiHeader({ name: 'X-OS', description: 'Operating system', required: false })
  @ApiHeader({ name: 'X-Browser', description: 'Browser name', required: false })
  async resendOtp(@SecurityContextDecorator() securityContext: SecurityContext): Promise<any> {
    const result = await this.loginSecurityService.resendLoginOtp(securityContext);
    return this.transformResponse(`Verification code resent to ${result.maskedContact}`, result, HttpStatus.OK);
  }
}
