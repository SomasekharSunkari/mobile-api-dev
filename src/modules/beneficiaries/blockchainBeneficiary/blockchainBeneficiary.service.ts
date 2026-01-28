import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IPaginatedResponse } from '../../../database';
import { BlockchainBeneficiaryModel, UserModel } from '../../../database/models';
import { UserRepository } from '../../auth/user/user.repository';
import { BlockchainBeneficiaryRepository } from './blockchainBeneficiary.repository';
import { CreateBlockchainBeneficiaryDto } from './dto/create-blockchain-beneficiary.dto';

@Injectable()
export class BlockchainBeneficiaryService {
  constructor(
    private readonly blockchainBeneficiaryRepository: BlockchainBeneficiaryRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async create(user: UserModel, createDto: CreateBlockchainBeneficiaryDto): Promise<BlockchainBeneficiaryModel> {
    const existingBeneficiary = await this.blockchainBeneficiaryRepository.findOne({
      user_id: user.id,
      beneficiary_user_id: createDto.beneficiary_user_id,
      address: createDto.address,
      network: createDto.network,
    });

    if (existingBeneficiary) {
      throw new BadRequestException('Beneficiary already exists');
    }

    // make sure the beneficiary user exists
    const beneficiaryUser = await this.userRepository.findOne({ id: createDto.beneficiary_user_id });

    return await this.blockchainBeneficiaryRepository.create({
      user_id: user.id,
      ...createDto,
      beneficiary_user_id: beneficiaryUser?.id,
    });
  }

  async findAll(user: UserModel, search?: string): Promise<IPaginatedResponse<BlockchainBeneficiaryModel>> {
    let query = this.blockchainBeneficiaryRepository.findSync({ user_id: user.id });
    const LIMIT = 10; // we will only return the last 10 beneficiaries, no pagination included
    const PAGE = 1;

    if (search) {
      // Join the beneficiaryUser table for searching
      query = query.joinRelated('beneficiaryUser').where((builder) => {
        builder
          .whereILike('alias_name', `%${search}%`)
          .orWhereILike('beneficiaryUser.username', `%${search}%`)
          .orWhereILike('beneficiaryUser.first_name', `%${search}%`)
          .orWhereILike('beneficiaryUser.last_name', `%${search}%`)
          .orWhereILike('beneficiaryUser.middle_name', `%${search}%`)
          .orWhereILike('beneficiaryUser.email', `%${search}%`)
          .orWhereILike('beneficiaryUser.phone_number', `%${search}%`);
      });
    }

    query = query.withGraphFetched('beneficiaryUser').modifyGraph('beneficiaryUser', (builder) => {
      builder.select(UserModel.publicProperty());
    });

    return await this.blockchainBeneficiaryRepository.paginateData(query, LIMIT, PAGE);
  }

  async findById(id: string, user: UserModel): Promise<BlockchainBeneficiaryModel> {
    const beneficiary = await this.blockchainBeneficiaryRepository.findOne({ id, user_id: user.id });
    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }
    return beneficiary;
  }

  async delete(id: string, user: UserModel): Promise<void> {
    const beneficiary = await this.findById(id, user);
    await this.blockchainBeneficiaryRepository.delete(beneficiary.id);
  }
}
