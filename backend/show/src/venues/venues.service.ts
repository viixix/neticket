import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from './entities/venue.entity';
import { Block } from './entities/block.entity';
import { CreateVenueRequestDto } from './dto/create-venue-request.dto';
import { GetVenuesResponseDto } from './dto/get-venues-response.dto';
import { GetVenueResponseDto } from './dto/get-venue-response.dto';
import { CreateBlocksRequestDto } from './dto/create-blocks-request.dto';
import { BlockRepository } from './block.repository';
import { API_ERROR_CODES, TicketException } from '@neticket/shared-nestjs';

@Injectable()
export class VenuesService {
  constructor(
    @InjectRepository(Venue)
    private venuesRepository: Repository<Venue>,
    private blocksRepository: BlockRepository,
  ) {}

  async create(requestDto: CreateVenueRequestDto): Promise<{ id: number }> {
    const venue = new Venue(requestDto.venue_name, requestDto.block_map_url);
    const savedVenue = await this.venuesRepository.save(venue);
    return { id: savedVenue.id };
  }

  async findAll(): Promise<GetVenuesResponseDto> {
    const venues = await this.venuesRepository.find();
    return GetVenuesResponseDto.fromEntities(venues);
  }

  async findOneWithBlocks(id: number): Promise<GetVenueResponseDto | null> {
    const venue = await this.venuesRepository.findOne({
      where: { id },
      relations: ['blocks'],
    });

    if (!venue) {
      return null;
    }

    return GetVenueResponseDto.fromEntity(venue);
  }

  async createBlocks(
    venueId: number,
    requestDto: CreateBlocksRequestDto,
  ): Promise<void> {
    const venue = await this.venuesRepository.findOne({
      where: { id: venueId },
    });

    if (!venue) {
      throw new TicketException(
        API_ERROR_CODES.VENUE_NOT_FOUND,
        '공연장을 찾을 수 없습니다.',
        404,
      );
    }

    const requestBlockNames = requestDto.blocks.map((b) => b.blockDataName);
    const duplicateNames = await this.blocksRepository.findExistingBlockNames(
      venueId,
      requestBlockNames,
    );

    if (duplicateNames.length > 0) {
      throw new TicketException(
        API_ERROR_CODES.BLOCK_NAME_DUPLICATE,
        `중복된 블록 이름이 존재합니다: ${duplicateNames.join(', ')}`,
        409,
      );
    }

    const blocks = requestDto.blocks.map((dto) => {
      return new Block(venue.id, dto.blockDataName, dto.rowSize, dto.colSize);
    });

    await this.blocksRepository.save(blocks);
  }
}
