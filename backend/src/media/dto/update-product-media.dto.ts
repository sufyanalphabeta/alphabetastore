import { IsIn } from 'class-validator';

export class UpdateProductMediaDto {
  @IsIn(['PRIMARY', 'GALLERY'])
  role!: 'PRIMARY' | 'GALLERY';
}
