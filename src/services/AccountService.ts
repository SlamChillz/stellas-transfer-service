import type { AccountRepository } from '../repositories/AccountRepository';
import type { Account } from '../models';
import { AccountNotFoundError } from '../types/errors';
import type { AccountStatus } from '../repositories/AccountRepository';

export interface AccountServiceDeps {
  accountRepository: AccountRepository;
}

export function createAccountService(deps: AccountServiceDeps) {
  const { accountRepository } = deps;

  async function getById(id: string): Promise<Account> {
    const account = await accountRepository.findById(id);
    if (!account) throw new AccountNotFoundError(id);
    return account;
  }

  async function updateStatus(id: string, status: AccountStatus): Promise<Account> {
    const account = await accountRepository.updateStatus(id, status);
    if (!account) throw new AccountNotFoundError(id);
    return account;
  }

  return { getById, updateStatus };
}
