import { PartialType } from '@nestjs/mapped-types';
import { CreateBundleDto } from './bundle.dto';

export class UpdateBundleDto extends PartialType(CreateBundleDto) {}
