import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FetchQuery, IPaginatedResponse } from '../../../database/base/base.interface';
import { BankBeneficiaryModel, UserModel } from '../../../database/models';
import { BankBeneficiaryRepository } from './bankBeneficiary.repository';
import { CreateBankBeneficiaryDto } from './dto/create-bank-beneficiary.dto';

@Injectable()
export class BankBeneficiaryService {
  @Inject(BankBeneficiaryRepository)
  private readonly bankBeneficiaryRepository: BankBeneficiaryRepository;

  async create(user: UserModel, createDto: CreateBankBeneficiaryDto): Promise<BankBeneficiaryModel> {
    const existingBeneficiary = await this.bankBeneficiaryRepository.findOne({
      user_id: user.id,
      account_number: createDto.account_number,
      bank_ref: createDto.bank_ref,
    });

    if (existingBeneficiary) {
      throw new BadRequestException('Beneficiary already exists');
    }
    return await this.bankBeneficiaryRepository.create({
      user_id: user.id,
      ...createDto,
    });
  }

  async findAll(user: UserModel, findQuery: FetchQuery): Promise<IPaginatedResponse<BankBeneficiaryModel>> {
    const query = this.bankBeneficiaryRepository.findSync({ user_id: user.id });
    const LIMIT = 10; // we will only return the last 10 beneficiaries, no pagination included
    const PAGE = 1;

    if (findQuery.search) {
      query.joinRelated('user').where((builder) => {
        builder
          .whereILike(`${BankBeneficiaryModel.tableName}.alias_name`, `%${findQuery.search}%`)
          .orWhereILike(`${BankBeneficiaryModel.tableName}.account_number`, `%${findQuery.search}%`)
          .orWhereILike(`${BankBeneficiaryModel.tableName}.bank_name`, `%${findQuery.search}%`)
          .orWhereILike(`${BankBeneficiaryModel.tableName}.bank_code`, `%${findQuery.search}%`)
          .orWhereILike(`${UserModel.tableName}.first_name`, `%${findQuery.search}%`)
          .orWhereILike(`${UserModel.tableName}.last_name`, `%${findQuery.search}%`)
          .orWhereILike(`${UserModel.tableName}.username`, `%${findQuery.search}%`)
          .orWhereILike(`${UserModel.tableName}.email`, `%${findQuery.search}%`)
          .orWhereILike(`${UserModel.tableName}.phone_number`, `%${findQuery.search}%`);
      });
    }

    return await this.bankBeneficiaryRepository.paginateData(query, LIMIT, PAGE);
  }

  async findById(id: string, user: UserModel): Promise<BankBeneficiaryModel> {
    const beneficiary = await this.bankBeneficiaryRepository.findOne({ id, user_id: user.id });
    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }
    return beneficiary;
  }

  async delete(id: string, user: UserModel): Promise<void> {
    const beneficiary = await this.findById(id, user);
    await this.bankBeneficiaryRepository.delete(beneficiary.id);
  }
}
