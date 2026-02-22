import { Router } from 'express';
import {
  createTransferController,
  createGetAccountController,
  createPatchAccountController,
  createListTransfersForAccountController,
  createListLedgerEntriesForAccountController,
  createGetTransferByIdController,
  createGetTransferByReferenceController,
  createCreateAccountController,
  createTopUpBalanceController,
  createConcurrencyDemoController,
} from '../controllers';
import { validateTransferBody } from '../middlewares/validateTransfer';
import { validatePatchAccountBody } from '../middlewares/validatePatchAccount';
import { validateCreateAccountBody, validateTopUpBody } from '../middlewares/validateTestHelpers';
import { validateConcurrencyDemoBody } from '../middlewares/validateConcurrencyDemo';
import { validateUuidParam } from '../middlewares/validateUuidParam';
import { requireTestEndpoints } from '../middlewares/requireTestEndpoints';
import { asyncHandler } from '../middlewares/errorHandler';
import { createTransferService } from '../services/TransferService';
import { createAccountService } from '../services/AccountService';
import { createTestHelpersService } from '../services/TestHelpersService';
import {
  createAccountRepository,
  createTransferRepository,
  createLedgerEntryRepository,
  createAuditLogRepository,
} from '../repositories';
import { sequelize } from '../models';

const router = Router();

const accountRepository = createAccountRepository();
const transferRepository = createTransferRepository();
const ledgerEntryRepository = createLedgerEntryRepository();
const auditLogRepository = createAuditLogRepository();

const transferService = createTransferService({
  accountRepository,
  transferRepository,
  ledgerEntryRepository,
  auditLogRepository,
  getTransaction: () => sequelize.transaction(),
});

const accountService = createAccountService({ accountRepository });

const testHelpersService = createTestHelpersService({
  accountRepository,
  ledgerEntryRepository,
  getTransaction: () => sequelize.transaction(),
});

const postTransfer = createTransferController(transferService.executeTransfer);
const getAccount = createGetAccountController(accountService.getById);
const patchAccount = createPatchAccountController(accountService.updateStatus);
const listTransfersForAccount = createListTransfersForAccountController(
  accountService.getById,
  transferRepository
);
const listLedgerEntriesForAccount = createListLedgerEntriesForAccountController(
  accountService.getById,
  ledgerEntryRepository
);
const getTransferById = createGetTransferByIdController(transferRepository.findById.bind(transferRepository));
const getTransferByReference = createGetTransferByReferenceController(
  transferRepository.findByReference.bind(transferRepository)
);

const postCreateAccount = createCreateAccountController(testHelpersService.createAccount);
const postTopUpBalance = createTopUpBalanceController(testHelpersService.topUpBalance);
const postConcurrentTransfersDemo = createConcurrencyDemoController(
  transferService.executeTransfer,
  accountRepository
);

const validateId = validateUuidParam('id');

// Transfers
router.post('/transfers', validateTransferBody, asyncHandler(postTransfer));
router.get('/transfers', asyncHandler(getTransferByReference));
router.get('/transfers/:id', validateId, asyncHandler(getTransferById));

// Accounts
router.get('/accounts/:id', validateId, asyncHandler(getAccount));
router.patch('/accounts/:id', validateId, validatePatchAccountBody, asyncHandler(patchAccount));
router.get('/accounts/:id/transfers', validateId, asyncHandler(listTransfersForAccount));
router.get('/accounts/:id/ledger-entries', validateId, asyncHandler(listLedgerEntriesForAccount));

// Test-only endpoints: account creation, top-up, concurrency demo (disabled in production)
const testRouter = Router();
testRouter.post('/accounts', validateCreateAccountBody, asyncHandler(postCreateAccount));
testRouter.post('/accounts/:id/top-up', validateId, validateTopUpBody, asyncHandler(postTopUpBalance));
testRouter.post(
  '/demo/concurrent-transfers',
  validateConcurrencyDemoBody,
  asyncHandler(postConcurrentTransfersDemo)
);
router.use(requireTestEndpoints, testRouter);

export const v1Router = router;
