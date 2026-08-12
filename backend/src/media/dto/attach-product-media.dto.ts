import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class AttachProductMediaDto {
  @IsUUID()
  mediaAssetId!: string;

  @IsOptional()
  @IsIn(['PRIMARY', 'GALLERY'])
  role?: 'PRIMARY' | 'GALLERY';
}
