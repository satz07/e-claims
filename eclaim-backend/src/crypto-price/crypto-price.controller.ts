import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CryptoPriceService } from './crypto-price.service';
import {
  CryptoQuoteRequestDto,
  CryptoQuoteResponseDto,
} from './dto/crypto-quote.dto';
import { CustomRequest } from 'src/types/Request';
import { CurrentUser } from 'src/common/decorators/user.decorator';

@ApiTags('Crypto Price')
@ApiBearerAuth('access-token')
@Controller('crypto-price')
export class CryptoPriceController {
  constructor(private readonly cryptoPriceService: CryptoPriceService) {}

  @Post('validate')
  @ApiOperation({
    summary: 'Validate buy/sell payload against CoinMarketCap live price',
  })
  @ApiBody({ type: CryptoQuoteRequestDto })
  @ApiOkResponse({ type: CryptoQuoteResponseDto })
  async validateTrade(
    @Body() dto: CryptoQuoteRequestDto,
    @CurrentUser() req: CustomRequest,
  ): Promise<CryptoQuoteResponseDto> {
    return this.cryptoPriceService.validateTrade(dto, req.user.wallet.walletId);
  }

  @Get('live/:symbol')
  @ApiOperation({ summary: 'Get live crypto price by symbol' })
  @ApiParam({ name: 'symbol', example: 'BTC' })
  async getLivePrice(@Param('symbol') symbol: string) {
    return this.cryptoPriceService.getLiveQuote(symbol);
  }
}
