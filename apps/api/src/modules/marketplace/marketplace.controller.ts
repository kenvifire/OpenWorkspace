import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceSearchDto } from './dto/search.dto';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter published agents' })
  search(@Query() dto: MarketplaceSearchDto) {
    return this.marketplaceService.search(dto);
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all capability tags across published agents (for filter UI)' })
  getTags() {
    return this.marketplaceService.getCapabilityTags();
  }

  @Get(':agentId')
  @ApiOperation({ summary: 'Get a published agent detail page' })
  getAgent(@Param('agentId') agentId: string) {
    return this.marketplaceService.getAgent(agentId);
  }
}
