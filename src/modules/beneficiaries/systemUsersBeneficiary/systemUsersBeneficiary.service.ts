import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IPaginatedResponse } from '../../../database/base/base.interface';
import { SystemUsersBeneficiaryModel, UserModel } from '../../../database/models';
import { UserRepository } from '../../auth/user/user.repository';
import { CreateSystemUsersBeneficiaryDto } from './dto/create-system-users-beneficiary.dto';
import { SystemUsersBeneficiaryRepository } from './systemUsersBeneficiary.repository';

@Injectable()
export class SystemUsersBeneficiaryService {
  @Inject(SystemUsersBeneficiaryRepository)
  private readonly systemUsersBeneficiaryRepository: SystemUsersBeneficiaryRepository;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  async create(user: UserModel, createDto: CreateSystemUsersBeneficiaryDto): Promise<SystemUsersBeneficiaryModel> {
    const { beneficiary_user_id, alias_name } = createDto;

    // Prevent self-beneficiary
    if (user.id === beneficiary_user_id) {
      throw new BadRequestException('Cannot add yourself as a beneficiary');
    }

    // Check if beneficiary relationship already exists
    const existingBeneficiary = await this.systemUsersBeneficiaryRepository.findOne({
      sender_user_id: user.id,
      beneficiary_user_id,
    });

    if (existingBeneficiary) {
      throw new BadRequestException('Beneficiary already exists');
    }

    return await this.systemUsersBeneficiaryRepository.create({
      sender_user_id: user.id,
      beneficiary_user_id,
      alias_name,
    });
  }

  async findAll(
    user: UserModel,
    search?: string,
  ): Promise<IPaginatedResponse<SystemUsersBeneficiaryModel> | { users: UserModel[] }> {
    const LIMIT = 10;
    const PAGE = 1;

    // When search is provided, search all users in the system
    if (search) {
      let usersQuery = this.userRepository.findSync({});

      // Exclude the current user
      usersQuery = usersQuery.where(`${UserModel.tableName}.id`, '!=', user.id);

      // Search across user fields
      usersQuery = usersQuery.where((builder) => {
        builder
          .whereILike(`${UserModel.tableName}.first_name`, `%${search}%`)
          .orWhereILike(`${UserModel.tableName}.last_name`, `%${search}%`)
          .orWhereILike(`${UserModel.tableName}.middle_name`, `%${search}%`)
          .orWhereILike(`${UserModel.tableName}.username`, `%${search}%`)
          .orWhereILike(`${UserModel.tableName}.email`, `%${search}%`)
          .orWhereILike(`${UserModel.tableName}.phone_number`, `%${search}%`);
      });

      // Select only public properties
      usersQuery = usersQuery.select(UserModel.publicProperty());

      // Order by updated_at
      usersQuery = usersQuery.clearOrder().orderBy(`${UserModel.tableName}.updated_at`, 'desc');

      // Limit results
      usersQuery = usersQuery.limit(LIMIT);

      const users = await usersQuery;
      return { users };
    }

    // When no search, return saved beneficiaries
    let query = this.systemUsersBeneficiaryRepository.findSync({ sender_user_id: user.id });

    // Filter out deleted records
    query = query.whereNull(`${SystemUsersBeneficiaryModel.tableName}.deleted_at`);

    query = query.withGraphFetched('beneficiaryUser').modifyGraph('beneficiaryUser', (builder) => {
      builder.select(UserModel.publicProperty());
    });

    return await this.systemUsersBeneficiaryRepository.paginateData(query, LIMIT, PAGE);
  }

  async findById(id: string, user: UserModel): Promise<SystemUsersBeneficiaryModel> {
    const query = this.systemUsersBeneficiaryRepository.findSync(
      { id, sender_user_id: user.id },
      {},
      { graphFetch: '[beneficiaryUser]' },
    );

    // Filter out deleted records
    query.whereNull('deleted_at');

    query.modifyGraph('beneficiaryUser', (builder) => {
      builder.select(UserModel.publicProperty());
    });

    const beneficiary = await query.first();

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    return beneficiary;
  }

  async delete(id: string, user: UserModel): Promise<void> {
    const beneficiary = await this.findById(id, user);

    await this.systemUsersBeneficiaryRepository.delete(beneficiary.id);
  }
}
