// wallet.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

import { WalletService } from './wallet.service';
import { SignedPostDto } from './dto/signed-post.dto';
import { SendAssetDto } from './dto/send-asset.dto';
import { CreateSwapDto, CreateSwapQuoteDto } from './dto/swap-dtos';
import { CustomCreateWalletDto } from './dto/custom-create-wallet.dto';
import { DelegateWalletDto } from './dto/delegate-wallet.dto';
import { parseDFNSToken } from '../utils/parseDFNSToken/parseDFNSToken';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { CustomRequest } from 'src/types/Request';

@ApiTags('Wallet')
@ApiExtraModels(CreateSwapQuoteDto, CreateSwapDto)
@ApiBearerAuth('access-token')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('wallets/custom')
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.CREATED)
  createWalletCustom(@Body() body: CustomCreateWalletDto) {
    return this.walletService.createWalletCustom(body);
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Create a DFNS transaction' })
  @HttpCode(HttpStatus.CREATED)
  createTransaction(@Body() body: SignedPostDto) {
    return this.walletService.createTransaction(body);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send assets from a wallet' })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: SendAssetDto })
  send(@Body() body: SendAssetDto, @CurrentUser() req: CustomRequest) {
    return this.walletService.sendAsset(
      body as unknown as SignedPostDto,
      req.user.wallet.walletId,
    );
  }

  @Post('swaps')
  @ApiOperation({ summary: 'Create a swap' })
  @HttpCode(HttpStatus.ACCEPTED)
  swap(@Body() body: SignedPostDto) {
    return this.walletService.swapAssets(body);
  }

  @Post('swaps/quotes')
  @ApiOperation({ summary: 'Create a swap quote' })
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({
    schema: { $ref: getSchemaPath(CreateSwapQuoteDto) },
    examples: {
      sepoliaErc20ToErc20: {
        summary: 'Sepolia: USDC -> WETH',
        value: {
          provider: 'UniswapClassic',
          walletId: 'wa-REPLACE_WITH_SEPOLIA_WALLET',
          sourceAsset: {
            kind: 'Erc20',
            contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            amount: '1000000',
          },
          targetAsset: {
            kind: 'Erc20',
            contract: '0xdd13E55209Fd76AfE204dBda4007C227904f0a81',
          },
          slippageBps: 50,
        },
      },
      amoyNativeToWmatic: {
        summary: 'Polygon Amoy: Native MATIC -> WMATIC',
        value: {
          provider: 'UniswapClassic',
          walletId: 'wa-REPLACE_WITH_AMOY_WALLET',
          sourceAsset: {
            kind: 'Native',
            amount: '1000000000000000',
          },
          targetAsset: {
            kind: 'Erc20',
            contract: '0xREPLACE_WMATIC_CONTRACT_AMOY',
          },
          slippageBps: 50,
        },
      },
    },
  })
  createSwapQuote(@Body() body: CreateSwapQuoteDto) {
    return this.walletService.createSwapQuote(body);
  }

  @Post('swaps/execute')
  @ApiOperation({ summary: 'Execute a swap using a quote' })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({
    schema: { $ref: getSchemaPath(CreateSwapDto) },
    examples: {
      sepoliaErc20ToErc20: {
        summary: 'Execute USDC -> WETH using quoteId',
        value: {
          quoteId: 'sq-REPLACE_FROM_QUOTE',
          provider: 'UniswapClassic',
          walletId: 'wa-REPLACE_WITH_SEPOLIA_WALLET',
          slippageBps: 50,
          sourceAsset: {
            kind: 'Erc20',
            contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            amount: '1000000',
          },
          targetAsset: {
            kind: 'Erc20',
            contract: '0xdd13E55209Fd76AfE204dBda4007C227904f0a81',
            amount: '300000000000000000',
          },
        },
      },
      amoyNativeToWmatic: {
        summary: 'Execute MATIC -> WMATIC using quoteId',
        value: {
          quoteId: 'sq-REPLACE_FROM_QUOTE',
          provider: 'UniswapClassic',
          walletId: 'wa-REPLACE_WITH_AMOY_WALLET',
          slippageBps: 50,
          sourceAsset: {
            kind: 'Native',
            amount: '1000000000000000',
          },
          targetAsset: {
            kind: 'Erc20',
            contract: '0xREPLACE_WMATIC_CONTRACT_AMOY',
            amount: '100000000000000000',
          },
        },
      },
    },
  })
  createSwap(@Body() body: CreateSwapDto) {
    return this.walletService.createSwap(body);
  }

  @Post('assets')
  @ApiOperation({ summary: 'Create or register a custom asset' })
  @HttpCode(HttpStatus.CREATED)
  createAsset(@Body() body: SignedPostDto) {
    return this.walletService.createCustomAsset(body);
  }

  @Get('networks/fees')
  @ApiOperation({ summary: 'Get DFNS network fee estimates' })
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'network',
    required: true,
    description: 'DFNS network name',
    example: 'EthereumSepolia',
  })
  listNetworkFees(@Query('network') network: string) {
    return this.walletService.listNetworkFees(network);
  }

  @Get('wallets')
  @ApiOperation({ summary: 'List wallets for current authenticated user' })
  @HttpCode(HttpStatus.OK)
  listWallets(@CurrentUser() req: CustomRequest) {
    const { userId } = req.user;

    if (!userId) {
      throw new BadRequestException('Authenticated userId is required');
    }

    return this.walletService.listWalletsByUser(userId);
  }

  @Get('wallets/by-org-user')
  @ApiOperation({ summary: 'List wallets by org user tag' })
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'orgUserId',
    required: true,
    description: 'Org user id used in tag creator:<orgUserId>',
  })
  listWalletsByOrgUser(@Query('orgUserId') orgUserId: string) {
    return this.walletService.listWalletsByOrgUser(orgUserId);
  }

  @Get('token/inspect')
  @ApiOperation({ summary: 'Inspect token and return decoded info' })
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'JWT token; if omitted, Authorization header is used',
  })
  inspectToken(@Query('token') token: string | undefined, @Req() req: Request) {
    const authHeader = req.headers.authorization;
    const source = token ?? authHeader;

    const info = parseDFNSToken(source);

    if (!info) {
      throw new BadRequestException(
        'Provide a valid JWT via token query or Authorization header',
      );
    }

    return {
      userId: info.userId ?? null,
      orgId: info.orgId ?? null,
      tokenKind: info.tokenKind ?? null,
    };
  }

  @Post('wallets/create/user-wallet')
  @ApiOperation({ summary: 'Create wallet for current user if not exists' })
  @HttpCode(HttpStatus.OK)
  userWalletCreation(@CurrentUser() req: CustomRequest) {
    return this.walletService.userWalletCreation(req.user.userId);
  }

  @Get('wallets/:walletId')
  // @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Get wallet by id' })
  @ApiParam({
    name: 'walletId',
    required: true,
    description: 'DFNS wallet id',
  })
  @HttpCode(HttpStatus.OK)
  getWallet(@Param('walletId') walletId: string) {
    return this.walletService.getWallet(walletId);
  }

  @Get('wallets/:walletId/transfers')
  @ApiOperation({ summary: 'Get wallet history / transfers' })
  @ApiParam({
    name: 'walletId',
    required: true,
    description: 'DFNS wallet id',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max items to return',
    example: 50,
  })
  @ApiQuery({
    name: 'pageNumber',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'pageToken',
    required: false,
    description: 'Pagination token from previous response',
  })
  @ApiQuery({
    name: 'direction',
    required: false,
    description: 'Filter by transfer direction: In or Out',
    example: 'In',
  })
  @HttpCode(HttpStatus.OK)
  getWalletHistory(
    @Param('walletId') walletId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.walletService.getWalletHistory(walletId, query);
  }

  @Post('wallets/:walletId/delegate')
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  delegateWallet(
    @Param('walletId') walletId: string,
    @Body() body: DelegateWalletDto,
  ) {
    return this.walletService.delegateWallet(walletId, body.userId);
  }

  @Get('wallets/:walletId/assets')
  // @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Get wallet assets' })
  @ApiParam({
    name: 'walletId',
    required: true,
    description: 'DFNS wallet id',
  })
  @HttpCode(HttpStatus.OK)
  getWalletAssets(
    @Param('walletId') walletId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.walletService.getWalletAssets(walletId, query);
  }

  @Get('wallets/:walletId/balance')
  // @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiParam({
    name: 'walletId',
    required: true,
    description: 'DFNS wallet id',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'Token symbol or ERC20 contract address',
    example: 'Infinia',
  })
  @HttpCode(HttpStatus.OK)
  getWalletBalance(
    @Param('walletId') walletId: string,
    @Query('token') token?: string,
  ) {
    return this.walletService.getWalletBalance(walletId, token);
  }
}

@ApiTags('Well-Known')
@Controller('.well-known')
export class WellKnownController {
  @Get('assetlinks.json')
  @ApiOperation({ summary: 'Android Digital Asset Links' })
  @Header('Content-Type', 'application/json')
  getAssetLinks() {
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.adiwallet',
          sha256_cert_fingerprints: [
            'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C',
          ],
        },
      },
    ];
  }
}
