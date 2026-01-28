import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { BaseController } from '../../base/base.controller';
import { UserModel } from '../../database/models/user/user.model';
import { IpAddress } from '../../decorators/IpAddress';
import { LocationRestrictions } from '../../decorators/LocationRestrictions';
import { Roles } from '../../decorators/Role';
import { User } from '../../decorators/User';
import { StreamService } from '../../services/streams/stream.service';
import { ROLES, RolesGuard } from '../auth/guard';
import { RegionalAccessGuard } from '../auth/guard/security-context.guard';
import { TransactionPinGuard } from '../auth/guard/transactionPinGuard/transactionPin.guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { CARD_LOCATION_RESTRICTIONS } from './card.interface';
import { CardService } from './card.service';
import { CardFundDto } from './dto/cardFund.dto';
import { CreateCardDto } from './dto/createCard.dto';
import { CreateCardUserDto } from './dto/createCardUser.dto';
import { CreateDisputeDto } from './dto/createDispute.dto';
import { AdminBlockUnlockCardDto } from './dto/adminBlockUnlockCard.dto';
import { ExecuteCardFundingFromNGNDto } from './dto/executeCardFundingFromNGN.dto';
import { InitiateCardFundingFromNGNDto } from './dto/initiateCardFundingFromNGN.dto';
import { FreezeCardDto } from './dto/freezeCard.dto';
import { FindCardTransactionsDto } from './dto/get-card-transactions.dto';
import { ReissueCardDto } from './dto/reissueCard.dto';
import { UpdateCardLimitDto } from './dto/updateCardLimit.dto';
import { AccountDeactivationGuard } from '../auth/guard/accountDeactivationGuard/accountDeactivation.guard';

@ApiTags('Card Users')
@Controller('card')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class CardController extends BaseController {
  @Inject(CardService)
  private readonly cardService: CardService;

  @Inject(StreamService)
  private readonly streamService: StreamService;

  @Get('users')
  @ApiOperation({
    summary: 'Get card user profile',
    description: 'Retrieves the card user profile for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Card user fetched successfully',
  })
  public async getCardUser(@User() user: UserModel) {
    const cardUser = await this.cardService.getCardUser(user);
    return this.transformResponse('Card user fetched successfully', cardUser, HttpStatus.OK);
  }

  @Post('users')
  @LocationRestrictions(CARD_LOCATION_RESTRICTIONS)
  @UseGuards(RegionalAccessGuard)
  @UseGuards(AccountDeactivationGuard)
  @ApiOperation({
    summary: 'Create card user profile',
    description: 'Creates a new card user profile with the card provider using KYC verification data',
  })
  @ApiBody({ type: CreateCardUserDto })
  public async create(
    @User() user: UserModel,
    @Body() createCardUserDto: CreateCardUserDto,
    @IpAddress() ipAddress: string,
  ) {
    const cardUser = await this.cardService.create(user, createCardUserDto, ipAddress);
    return this.transformResponse('Card user created successfully', cardUser, HttpStatus.CREATED);
  }

  @Get('onboard/occupations')
  @ApiOperation({
    summary: 'Get occupations list',
    description: 'Retrieves the occupations list from the card provider',
  })
  public async getOccupations() {
    const occupations = await this.cardService.getOccupations();
    return this.transformResponse('Occupations fetched successfully', occupations, HttpStatus.OK);
  }

  @Get('limit/frequencies')
  @ApiOperation({
    summary: 'Get card limit frequency options',
    description: 'Retrieves the list of available card limit frequency options',
  })
  public async getCardLimitFrequencies() {
    const frequencies = await this.cardService.getCardLimitFrequencies();
    return this.transformResponse('Card limit frequencies fetched successfully', frequencies, HttpStatus.OK);
  }

  @Get('fees/config')
  @ApiOperation({
    summary: 'Get card fees configuration',
    description:
      'Retrieves all card fee configurations including fee types, percentages, fixed amounts, and minimum fees',
  })
  @ApiResponse({
    status: 200,
    description: 'Card fees configuration retrieved successfully',
  })
  public async getCardFees() {
    const fees = this.cardService.getAllCardFees();
    return this.transformResponse('Card fees retrieved successfully', fees, HttpStatus.OK);
  }

  @Post()
  @LocationRestrictions(CARD_LOCATION_RESTRICTIONS)
  @UseGuards(RegionalAccessGuard)
  @UseGuards(AccountDeactivationGuard)
  @ApiOperation({ summary: 'Create a card (virtual or physical)' })
  @ApiBody({ type: CreateCardDto })
  public async createCard(@User() user: UserModel, @Body() dto: CreateCardDto) {
    const card = await this.cardService.createCard(user, dto);
    return this.transformResponse('Card created successfully', card, HttpStatus.CREATED);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get all card transactions for user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of card transactions' })
  public async getCardTransactions(@User() user: UserModel, @Query() query: FindCardTransactionsDto) {
    const transactions = await this.cardService.getCardTransactions(user.id, query);
    return this.transformResponse('Card transactions retrieved successfully', transactions);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get a card transaction by ID for user' })
  @ApiParam({ name: 'id', description: 'Card transaction ID', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Card transaction details' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Card transaction not found' })
  public async getCardTransaction(@User() user: UserModel, @Param('id') id: string) {
    const transaction = await this.cardService.getCardTransaction(id, user.id);
    return this.transformResponse('Card transaction retrieved successfully', transaction);
  }

  @Post('transactions/:id/disputes')
  @ApiOperation({ summary: 'Create a dispute for a card transaction' })
  @ApiParam({ name: 'id', description: 'Card transaction ID', type: 'string' })
  @ApiBody({ type: CreateDisputeDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Dispute created successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Card transaction not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Insufficient balance or invalid request' })
  public async createDispute(
    @User() user: UserModel,
    @Param('id') transactionId: string,
    @Body() createDisputeDto: CreateDisputeDto,
  ) {
    const dispute = await this.cardService.createDispute(user, transactionId, createDisputeDto);
    return this.transformResponse('Dispute created successfully', dispute, HttpStatus.CREATED);
  }

  @Get('transactions/:id/disputes/eligibility')
  @ApiOperation({ summary: 'Get dispute eligibility for a card transaction' })
  @ApiParam({ name: 'id', description: 'Card transaction ID', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Dispute eligibility evaluated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Card transaction not found' })
  public async getTransactionDisputeEligibility(@User() user: UserModel, @Param('id') transactionId: string) {
    const eligibility = await this.cardService.getTransactionDisputeEligibility(user, transactionId);
    return this.transformResponse('Dispute eligibility evaluated successfully', eligibility, HttpStatus.OK);
  }

  @Get(':card_id')
  @ApiOperation({
    summary: 'Get a single card',
    description: 'Retrieves a single card by ID for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Card fetched successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Card not found or does not belong to user',
  })
  public async getCard(@User() user: UserModel, @Param('card_id') cardId: string) {
    const card = await this.cardService.getCard(user, cardId);
    return this.transformResponse('Card fetched successfully', card, HttpStatus.OK);
  }

  @Post(':card_id/fund')
  @UseGuards(TransactionPinGuard)
  @ApiOperation({ summary: 'Fund a card with fiat or blockchain' })
  @ApiBody({ type: CardFundDto })
  public async fundCard(@User() user: UserModel, @Param('card_id') cardId: string, @Body() dto: CardFundDto) {
    const result = await this.cardService.fundCard(user, { ...dto, card_id: cardId } as any);
    return this.transformResponse('Card funding initiated successfully', result, HttpStatus.OK);
  }

  @Post(':card_id/fund/initiate')
  @ApiOperation({ summary: 'Initialize card funding from NGN wallet' })
  @ApiBody({ type: InitiateCardFundingFromNGNDto })
  @ApiResponse({ status: 200, description: 'Card funding initialization successful' })
  public async initializeCardFundingFromNGN(
    @User() user: UserModel,
    @Param('card_id') cardId: string,
    @Body() dto: InitiateCardFundingFromNGNDto,
  ) {
    const result = await this.cardService.initializeCardFundingFromNGN(user, cardId, dto);
    return this.transformResponse('Card funding initialization successful', result, HttpStatus.OK);
  }

  @Post(':card_id/fund/execute')
  @UseGuards(TransactionPinGuard)
  @ApiOperation({ summary: 'Execute card funding from NGN wallet' })
  @ApiBody({ type: ExecuteCardFundingFromNGNDto })
  @ApiResponse({ status: 200, description: 'Card funding execution initiated' })
  public async executeCardFundingFromNGN(
    @User() user: UserModel,
    @Param('card_id') cardId: string,
    @Body() dto: ExecuteCardFundingFromNGNDto,
  ) {
    const result = await this.cardService.executeCardFundingFromNGN(user, cardId, dto);
    return this.transformResponse('Card funding execution initiated', result, HttpStatus.OK);
  }

  @Get(':card_id/secrets')
  @ApiOperation({
    summary: 'Get card details (PAN and CVC)',
    description:
      'Retrieves decrypted card details including PAN (Primary Account Number) and CVC (Card Verification Code) for the specified card. The data is returned in decrypted format.',
  })
  public async getCardDetails(@User() user: UserModel, @Param('card_id') cardId: string) {
    const cardDetails = await this.cardService.getCardDetails(user, cardId);
    return this.transformResponse('Card details retrieved successfully', cardDetails, HttpStatus.OK);
  }

  @Patch(':card_id/freeze')
  @UseGuards(TransactionPinGuard)
  @ApiOperation({
    summary: 'Freeze or unfreeze a card',
    description:
      'Freezes or unfreezes a card by updating its status with the card provider (Rain). When freezing, the card status is set to LOCKED. When unfreezing, the card status is set to ACTIVE.',
  })
  @ApiBody({ type: FreezeCardDto })
  public async freezeOrUnfreezeCard(
    @User() user: UserModel,
    @Param('card_id') cardId: string,
    @Body() dto: FreezeCardDto,
  ) {
    const result = await this.cardService.freezeOrUnfreezeCard(user, cardId, dto);
    return this.transformResponse(`Card ${dto.freeze ? 'frozen' : 'unfrozen'} successfully`, result, HttpStatus.OK);
  }

  @Patch(':card_id/admin/block-unlock')
  @UseGuards(RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Block or unlock a card (Admin only)',
    description:
      'Blocks or unlocks a card by updating its status with the card provider (Rain). When blocking, the card status is set to LOCKED. When unlocking, the card status is set to ACTIVE. This endpoint can only be called by admins.',
  })
  @ApiParam({ name: 'card_id', description: 'Card ID', type: 'string' })
  @ApiBody({ type: AdminBlockUnlockCardDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Card blocked or unlocked successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Card not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied. Admin role required',
  })
  public async adminBlockOrUnlockCard(@Param('card_id') cardId: string, @Body() dto: AdminBlockUnlockCardDto) {
    const result = await this.cardService.adminBlockOrUnlockCard(cardId, dto);
    return this.transformResponse(`Card ${dto.block ? 'blocked' : 'unlocked'} successfully`, result, HttpStatus.OK);
  }

  @Patch(':card_id/cancel')
  @UseGuards(TransactionPinGuard)
  @ApiOperation({
    summary: 'Cancel a card',
    description:
      'Cancels a card by sending LOCKED status to the card provider (Rain) and marking it as canceled in OneDosh.',
  })
  @ApiParam({ name: 'card_id', description: 'Card ID', type: 'string' })
  public async cancelCard(@User() user: UserModel, @Param('card_id') cardId: string) {
    const result = await this.cardService.cancelCard(user, cardId);
    return this.transformResponse('Card canceled successfully', result, HttpStatus.OK);
  }

  @Post(':card_id/reissue')
  @LocationRestrictions(CARD_LOCATION_RESTRICTIONS)
  @UseGuards(RegionalAccessGuard)
  @UseGuards(TransactionPinGuard)
  @UseGuards(AccountDeactivationGuard)
  @ApiOperation({
    summary: 'Re-issue a card',
    description:
      'Cancels the specified active card and creates a new one. This is useful when a card needs to be replaced.',
  })
  @ApiParam({ name: 'card_id', description: 'Card ID to re-issue', type: 'string' })
  @ApiBody({ type: ReissueCardDto })
  public async reissueCard(@User() user: UserModel, @Param('card_id') cardId: string, @Body() dto: ReissueCardDto) {
    const result = await this.cardService.reissueCard(user, cardId, dto);
    return this.transformResponse('Card re-issued successfully', result, HttpStatus.CREATED);
  }

  @Patch(':card_id/limit')
  @ApiOperation({
    summary: 'Update card spending limit and frequency',
    description:
      'Updates the card spending limit amount and/or frequency with the card provider (Rain). Both amount and frequency are optional, but at least one must be provided.',
  })
  @ApiBody({ type: UpdateCardLimitDto })
  public async updateCardLimit(
    @User() user: UserModel,
    @Param('card_id') cardId: string,
    @Body() dto: UpdateCardLimitDto,
  ) {
    const result = await this.cardService.updateCardLimit(user, cardId, dto);
    return this.transformResponse('Card limit updated successfully', result, HttpStatus.OK);
  }

  @Sse('balance/stream')
  @ApiOperation({ summary: 'Stream real-time card balance updates via Server-Sent Events' })
  @ApiResponse({
    status: 200,
    description: 'SSE connection established for real-time card balance updates',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'data: {"type":"connected","timestamp":"2024-01-01T00:00:00.000Z"}\n\n',
        },
      },
    },
  })
  streamBalanceUpdates(@User() user: UserModel): Observable<MessageEvent> {
    return this.streamService.getUserBalanceStream(user.id);
  }
}
